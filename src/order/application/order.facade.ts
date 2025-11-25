import { Injectable } from '@nestjs/common';
import { OrderDomainService } from '@/order/domain/services/order.service';
import { OrderItem } from '@/order/domain/entities/order-item.entity';
import { CouponDomainService } from '@/coupon/domain/services/coupon.service';
import { UserDomainService } from '@/user/domain/services/user.service';
import { ProductDomainService } from '@/product/domain/services/product.service';
import { PrismaService } from '@common/prisma-manager/prisma.service';

export interface OrderItemInput {
  productOptionId: number;
  quantity: number;
}

export interface OrderItemView {
  orderItemId: number;
  productOptionId: number;
  productName: string;
  price: number;
  quantity: number;
  subtotal: number;
}

export interface OrderCreateView {
  orderId: number;
  userId: number;
  items: OrderItemView[];
  totalAmount: number;
  status: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface OrderListView {
  orderId: number;
  totalAmount: number;
  discountAmount: number;
  finalAmount: number;
  status: string;
  createdAt: Date;
  paidAt: Date | null;
}

export interface OrderDetailView {
  orderId: number;
  userId: number;
  items: OrderItemView[];
  totalAmount: number;
  discountAmount: number;
  finalAmount: number;
  status: string;
  createdAt: Date;
  paidAt: Date | null;
}

export interface OrderPaymentView {
  orderId: number;
  status: string;
  paidAmount: number;
  remainingBalance: number;
  paidAt: Date;
}

@Injectable()
export class OrderFacade {
  constructor(
    private readonly orderService: OrderDomainService,
    private readonly productService: ProductDomainService,
    private readonly couponService: CouponDomainService,
    private readonly userService: UserDomainService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * OrderItem을 OrderItemView로 변환
   */
  private toOrderItemView(item: OrderItem): OrderItemView {
    return {
      orderItemId: item.id,
      productOptionId: item.productOptionId,
      productName: item.productName,
      price: item.price,
      quantity: item.quantity,
      subtotal: item.subtotal,
    };
  }

  /**
   * ANCHOR 주문 생성
   * 트랜잭션으로 재고 선점 + 주문 생성을 원자적으로 처리
   */
  async createOrder(
    userId: number,
    items: OrderItemInput[],
  ): Promise<OrderCreateView> {
    return await this.prisma.runInTransaction(async () => {
      await this.userService.getUser(userId);

      // 상품 정보 조회 및 재고 선점
      const orderItemsData =
        await this.productService.reserveProductsForOrder(items); // save

      // 총액 계산
      const totalAmount = orderItemsData.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      );

      // 주문 생성
      const createdOrder = await this.orderService.createPendingOrder(
        userId,
        totalAmount,
      ); // save

      // 주문 항목 생성
      const createdOrderItems = await this.orderService.createOrderItems(
        createdOrder.id,
        orderItemsData,
      ); // save

      return {
        orderId: createdOrder.id,
        userId: createdOrder.userId,
        items: createdOrderItems.map((item) => this.toOrderItemView(item)),
        totalAmount: createdOrder.totalAmount,
        status: createdOrder.status.value,
        createdAt: createdOrder.createdAt,
        expiresAt: createdOrder.expiredAt,
      };
    });
  }

  /**
   * ANCHOR 결제 처리
   * 트랜잭션으로 쿠폰 사용 + 결제 처리 + 재고 확정을 원자적으로 처리
   * 유저 포인트 차감은 낙관적 잠금이므로 트랜잭션 밖에서 처리하고,
   * 실패 시 보상 트랜잭션을 통해 쿠폰/주문/재고를 롤백
   */
  async processPayment(
    orderId: number,
    userId: number,
    userCouponId?: number,
  ): Promise<OrderPaymentView> {
    let paymentAmount = 0;
    let appliedUserCouponId: number | null = null;

    try {
      // 1단계: 트랜잭션 - 쿠폰 사용 + 주문 상태 변경 + 재고 확정
      await this.prisma.runInTransaction(async () => {
        // 주문 조회 (비관적 잠금)
        const order = await this.orderService.getOrder(orderId);
        order.validateOwnedBy(userId);

        // 쿠폰 요청
        if (userCouponId) {
          // 쿠폰 조회 (비관적 잠금)
          const userCoupon =
            await this.couponService.getUserCoupon(userCouponId);
          const coupon = await this.couponService.getCoupon(
            userCoupon.couponId,
          );

          // 쿠폰 사용 처리 및 할인 적용
          userCoupon.use(orderId);
          const discountAmount = coupon.calculateDiscount(order.totalAmount);
          order.applyCoupon(coupon.id, discountAmount);

          await this.couponService.updateUserCoupon(userCoupon);
          appliedUserCouponId = userCoupon.id;
        }

        paymentAmount = order.finalAmount;

        // 결제 처리
        order.pay();
        await this.orderService.updateOrder(order);

        // 재고 확정 차감 (선점 → 확정)
        // 재고 조회 (비관적 잠금)
        const orderItems = await this.orderService.getOrderItems(orderId);
        for (const item of orderItems) {
          await this.productService.confirmPaymentStock(
            item.productOptionId,
            item.quantity,
          );
        }
      });

      // 2단계: 트랜잭션 외부 - 사용자 잔액 차감 (낙관적 잠금)
      const user = await this.userService.deductBalance(
        userId,
        paymentAmount,
        orderId,
        `주문 ${orderId} 결제`,
      );

      return {
        orderId,
        status: 'PAID',
        paidAmount: paymentAmount,
        remainingBalance: user.balance,
        paidAt: new Date(),
      };
    } catch (error) {
      // 3단계: 보상 트랜잭션 - 유저 포인트 차감 실패 시 롤백
      if (paymentAmount > 0) {
        await this.compensatePaymentFailure(orderId, appliedUserCouponId).catch(
          (compensationError) => {
            // 보상 트랜잭션 실패는 로깅하고 원래 에러를 전파
            console.error(
              `보상 트랜잭션 실패 - orderId: ${orderId}`,
              compensationError,
            );
          },
        );
      }

      throw error;
    }
  }

  /**
   * 결제 실패 시 보상 트랜잭션
   * - 주문 상태를 PENDING으로 되돌림
   * - 쿠폰 사용 취소
   * - 재고 복원 (확정 차감 → 선점 상태로 복원)
   */
  private async compensatePaymentFailure(
    orderId: number,
    appliedUserCouponId: number | null,
  ): Promise<void> {
    await this.prisma.runInTransaction(async () => {
      // 주문 조회
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

      // 재고 복원 (확정 차감된 수량을 다시 선점 상태로)
      const orderItems = await this.orderService.getOrderItems(orderId);
      for (const item of orderItems) {
        // 재고 복원: 확정 차감된 수량을 다시 선점 상태로 되돌림
        await this.productService.restoreStockAfterPaymentFailure(
          item.productOptionId,
          item.quantity,
        );
      }
    });
  }

  /**
   * ANCHOR 주문 내역 조회
   */
  async getOrders(userId: number): Promise<OrderListView[]> {
    const orders = await this.orderService.getOrders(userId);

    return orders.map((order) => ({
      orderId: order.id,
      totalAmount: order.totalAmount,
      discountAmount: order.discountAmount,
      finalAmount: order.finalAmount,
      status: order.status.value,
      createdAt: order.createdAt,
      paidAt: order.paidAt,
    }));
  }

  /**
   * ANCHOR 주문 상세 조회
   */
  async getOrderDetail(orderId: number): Promise<OrderDetailView> {
    const order = await this.orderService.getOrder(orderId);
    const items = await this.orderService.getOrderItems(orderId);
    return {
      orderId: order.id,
      userId: order.userId,
      items: items.map((item) => this.toOrderItemView(item)),
      totalAmount: order.totalAmount,
      discountAmount: order.discountAmount,
      finalAmount: order.finalAmount,
      status: order.status.value,
      createdAt: order.createdAt,
      paidAt: order.paidAt,
    };
  }
}
