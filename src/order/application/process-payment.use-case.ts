import { Injectable } from '@nestjs/common';
import { OrderDomainService } from '@/order/domain/services/order.service';
import { CouponDomainService } from '@/coupon/domain/services/coupon.service';
import { UserDomainService } from '@/user/domain/services/user.service';
import { ProductDomainService } from '@/product/domain/services/product.service';
import { PrismaService } from '@common/prisma-manager/prisma.service';
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
    private readonly userService: UserDomainService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * ANCHOR 결제 처리
   * 트랜잭션으로 쿠폰 사용 + 결제 처리 + 재고 확정을 원자적으로 처리
   * 유저 포인트 차감은 낙관적 잠금이므로 트랜잭션 밖에서 처리하고,
   * 실패 시 보상 트랜잭션을 통해 쿠폰/주문/재고를 롤백
   */
  async execute(cmd: ProcessPaymentCommand): Promise<ProcessPaymentResult> {
    let paymentAmount = 0;
    let appliedUserCouponId: number | null = null;
    let orderItems: OrderItem[] = [];

    try {
      // 1단계: 트랜잭션 - 쿠폰 사용 + 주문 상태 변경 + 재고 확정
      await this.prisma.runInTransaction(async () => {
        const order = await this.orderService.getOrder(cmd.orderId);
        order.validateOwnedBy(cmd.userId);

        // 쿠폰 적용
        if (cmd.userCouponId) {
          const userCoupon = await this.couponService.getUserCoupon(
            cmd.userCouponId,
          );
          const coupon = await this.couponService.getCoupon(
            userCoupon.couponId,
          );

          userCoupon.use(cmd.orderId);
          const discountAmount = coupon.calculateDiscount(order.totalAmount);
          order.applyCoupon(coupon.id, discountAmount);

          await this.couponService.updateUserCoupon(userCoupon);
          appliedUserCouponId = userCoupon.id;
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

      // 2단계: 트랜잭션 외부 - 사용자 잔액 차감 (낙관적 잠금)
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
      // 3단계: 보상 트랜잭션 - 유저 포인트 차감 실패 시 롤백
      if (paymentAmount > 0) {
        await this.compensatePaymentFailure(
          cmd.orderId,
          appliedUserCouponId,
        ).catch((compensationError) => {
          console.error(
            `보상 트랜잭션 실패 - orderId: ${cmd.orderId}`,
            compensationError,
          );
        });
      }

      throw error;
    }
  }

  /**
   * 결제 실패 시 보상 트랜잭션
   */
  private async compensatePaymentFailure(
    orderId: number,
    appliedUserCouponId: number | null,
  ): Promise<void> {
    await this.prisma.runInTransaction(async () => {
      const order = await this.orderService.getOrder(orderId);

      // 주문 상태를 PENDING으로 되돌림
      order.cancelPayment();
      await this.orderService.updateOrder(order);

      // 쿠폰 사용 취소
      if (appliedUserCouponId) {
        const userCoupon =
          await this.couponService.getUserCoupon(appliedUserCouponId);
        userCoupon.cancelUse();
        await this.couponService.updateUserCoupon(userCoupon);
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
