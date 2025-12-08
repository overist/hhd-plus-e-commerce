import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrderDomainService } from '@/order/domain/services/order.service';
import { CouponDomainService } from '@/coupon/domain/services/coupon.service';
import { CouponRedisService } from '@/coupon/infrastructure/coupon.redis.service';
import { UserDomainService } from '@/user/domain/services/user.service';
import { ProductDomainService } from '@/product/domain/services/product.service';
import { PrismaService } from '@common/prisma-manager/prisma.service';
import { ApplicationException, ErrorCode } from '@common/exception';

// dto
import {
  ProcessPaymentCommand,
  ProcessPaymentResult,
} from './dto/process-payment.dto';

// domain entities
import { OrderItem } from '../domain/entities/order-item.entity';
import { Order } from '../domain/entities/order.entity';
import { Coupon } from '@/coupon/domain/entities/coupon.entity';
import { UserCoupon } from '@/coupon/domain/entities/user-coupon.entity';

@Injectable()
export class ProcessPaymentUseCase {
  private readonly logger = new Logger(ProcessPaymentUseCase.name);

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
   */
  async processPayment(
    cmd: ProcessPaymentCommand,
  ): Promise<ProcessPaymentResult> {
    let order: Order;
    let orderItems: OrderItem[] = [];
    let coupon: Coupon;
    let userCoupon: UserCoupon;

    try {
      // 1단계: Redis에서 쿠폰 사용 처리 (원자적)
      if (cmd.couponId) {
        coupon = await this.couponRedisService.getCachedCoupon(cmd.couponId);
        userCoupon = await this.couponRedisService.useUserCoupon(
          cmd.userId,
          cmd.couponId,
          cmd.orderId,
        );
      }

      // 2단계: 트랜잭션 - 주문 상태 변경 + 재고 확정 + 쿠폰 DB 저장
      await this.prisma.runInTransaction(async () => {
        order = await this.orderService.getOrder(cmd.orderId);
        order.validateOwnedBy(cmd.userId);

        // 쿠폰 할인 적용, Redis->DB 유저쿠폰 동기화
        if (cmd.couponId && userCoupon) {
          order.applyCoupon(coupon.id, coupon.discountRate); // TODO 정말 레디스 pkid를 db pkid로 삼아도 될지?
          await this.couponService.createUserCoupon(userCoupon);
        }

        // 주문 상태 업데이트
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
        order!.finalAmount,
        cmd.orderId,
        `주문 ${cmd.orderId} 결제`,
      );

      const result = ProcessPaymentResult.from(order!, user);
      return result;
    } catch (error) {
      // 1단계 쿠폰 사용 후 2단계 트랜잭션 실패 시 Redis 쿠폰 취소
      if (cmd.couponId) {
        await this.couponRedisService
          .cancelCouponUse(cmd.userId, cmd.couponId)
          .catch((e) =>
            this.logger.error(
              `Redis 쿠폰 취소 실패 - couponId: ${cmd.couponId}`,
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
