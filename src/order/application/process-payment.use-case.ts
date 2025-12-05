import { Injectable } from '@nestjs/common';
import { OrderDomainService } from '@/order/domain/services/order.service';
import { CouponDomainService } from '@/coupon/domain/services/coupon.service';
import { CouponRedisService } from '@/coupon/infrastructure/coupon.redis.service';
import { UserDomainService } from '@/user/domain/services/user.service';
import { ProductDomainService } from '@/product/domain/services/product.service';
import { PrismaService } from '@common/prisma-manager/prisma.service';
import { ApplicationException, ErrorCode } from '@common/exception';
import {
  ProcessPaymentCommand,
  ProcessPaymentResult,
} from './dto/process-payment.dto';
import { OrderItem } from '../domain/entities/order-item.entity';

@Injectable()
export class ProcessPaymentUseCase {
  constructor(
    private readonly orderService: OrderDomainService,
    private readonly productService: ProductDomainService,
    private readonly couponService: CouponDomainService,
    private readonly couponRedisService: CouponRedisService,
    private readonly userService: UserDomainService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * ANCHOR 결제 처리
   * Redis를 활용한 쿠폰 사용 + 트랜잭션으로 결제 처리 + 재고 확정을 처리
   * 유저 포인트 차감은 낙관적 잠금이므로 트랜잭션 밖에서 처리하고,
   * 실패 시 보상 트랜잭션을 통해 쿠폰/주문/재고를 롤백
   */
  async execute(cmd: ProcessPaymentCommand): Promise<ProcessPaymentResult> {
    let paymentAmount = 0;
    let appliedCouponId: number | null = null;
    let orderItems: OrderItem[] = [];
    let discountRate = 0;
    let couponUsedAt: Date | null = null;
    let couponExpiredAt: Date | null = null;
    let dbTransactionCompleted = false;

    try {
      // 1단계: Redis에서 쿠폰 사용 처리 (원자적)
      if (cmd.couponId) {
        const couponUseResult = await this.couponRedisService.useCoupon(
          cmd.userId,
          cmd.couponId,
          cmd.orderId,
        );

        if (!couponUseResult.success) {
          this.throwCouponException(couponUseResult.errorCode!);
        }

        appliedCouponId = cmd.couponId;
        discountRate = couponUseResult.coupon!.discountRate;
        couponUsedAt = couponUseResult.userCoupon!.usedAt;
        couponExpiredAt = couponUseResult.userCoupon!.expiredAt;
      }

      // 2단계: 트랜잭션 - 주문 상태 변경 + 재고 확정 + 쿠폰 사용 정보 DB 저장
      await this.prisma.runInTransaction(async () => {
        const order = await this.orderService.getOrder(cmd.orderId);
        order.validateOwnedBy(cmd.userId);

        // 쿠폰 할인 적용
        if (appliedCouponId && discountRate > 0) {
          const discountAmount = Math.floor(
            (order.totalAmount * discountRate) / 100,
          );
          order.applyCoupon(appliedCouponId, discountAmount);

          // 쿠폰 사용 정보를 DB에 저장 (Redis → DB 동기화)
          const newUserCoupon = await this.couponService.issueCouponToUser(
            cmd.userId,
            await this.couponService.getCoupon(appliedCouponId),
          );
          newUserCoupon.orderId = cmd.orderId;
          newUserCoupon.usedAt = couponUsedAt!;
          newUserCoupon.expiredAt = couponExpiredAt!;
          await this.couponService.updateUserCoupon(newUserCoupon);
        }

        paymentAmount = order.finalAmount;

        // 결제 처리
        order.pay();
        await this.orderService.updateOrder(order);

        // 재고 확정 차감
        orderItems = await this.orderService.getOrderItems(cmd.orderId);
        for (const item of orderItems) {
          await this.productService.confirmPaymentStock(
            item.productOptionId,
            item.quantity,
          );
        }
      });

      dbTransactionCompleted = true;

      // 3단계: 트랜잭션 외부 - 사용자 잔액 차감 (낙관적 잠금)
      const user = await this.userService.deductBalance(
        cmd.userId,
        paymentAmount,
        cmd.orderId,
        `주문 ${cmd.orderId} 결제`,
      );

      // 비동기로 인기상품 집계 (fire and forget)
      this.orderService.recordSales(orderItems);

      return ProcessPaymentResult.fromData(
        cmd.orderId,
        paymentAmount,
        user,
        new Date(),
      );
    } catch (error) {
      // 보상 트랜잭션
      if (appliedCouponId) {
        // Redis 쿠폰 사용은 항상 취소 (1단계 성공 후 실패한 경우)
        await this.couponRedisService
          .cancelCouponUse(cmd.userId, appliedCouponId)
          .catch((e) =>
            console.error(
              `Redis 쿠폰 취소 실패 - couponId: ${appliedCouponId}`,
              e,
            ),
          );
      }

      // DB 트랜잭션이 완료된 후 잔액 차감 실패 시 DB 롤백 필요
      if (dbTransactionCompleted) {
        await this.compensateDbTransaction(cmd.orderId, appliedCouponId).catch(
          (compensationError) => {
            console.error(
              `DB 보상 트랜잭션 실패 - orderId: ${cmd.orderId}`,
              compensationError,
            );
          },
        );
      }

      throw error;
    }
  }

  /**
   * 쿠폰 사용 실패 시 예외 처리
   */
  private throwCouponException(
    errorCode: 'USER_COUPON_NOT_FOUND' | 'ALREADY_USED' | 'EXPIRED_COUPON',
  ): never {
    switch (errorCode) {
      case 'USER_COUPON_NOT_FOUND':
        throw new ApplicationException(ErrorCode.COUPON_NOT_FOUND);
      case 'ALREADY_USED':
        throw new ApplicationException(ErrorCode.ALREADY_USED);
      case 'EXPIRED_COUPON':
        throw new ApplicationException(ErrorCode.EXPIRED_COUPON);
    }
  }

  /**
   * DB 트랜잭션 보상 (잔액 차감 실패 시)
   * 주문 상태 복원 + 재고 복원 + DB 쿠폰 삭제
   */
  private async compensateDbTransaction(
    orderId: number,
    appliedCouponId: number | null,
  ): Promise<void> {
    await this.prisma.runInTransaction(async () => {
      const order = await this.orderService.getOrder(orderId);

      // 주문 상태를 PENDING으로 되돌림
      order.cancelPayment();
      await this.orderService.updateOrder(order);

      // DB에 저장된 쿠폰 사용 기록 삭제
      if (appliedCouponId) {
        await this.couponService.deleteUserCouponByOrderId(orderId);
      }

      // 재고 복원
      const orderItems = await this.orderService.getOrderItems(orderId);
      for (const item of orderItems) {
        await this.productService.restoreStockAfterPaymentFailure(
          item.productOptionId,
          item.quantity,
        );
      }
    });
  }
}
