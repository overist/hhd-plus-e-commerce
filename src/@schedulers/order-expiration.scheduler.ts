import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  IOrderRepository,
  IOrderItemRepository,
} from '@/order/domain/interfaces/order.repository.interface';
import { IProductOptionRepository } from '@/product/domain/interfaces/product.repository.interface';
import { Order } from '@/order/domain/entities/order.entity';

/**
 * Order Expiration Scheduler
 * 주문 만료 및 재고 선점 자동 해제 스케줄러
 *
 * BR-005: 재고 선점은 최대 10분간 유지되며, 이후 자동 해제된다
 * RF-012: 시스템은 결제 창 진입 후 일정 시간(10분) 내 미결제 시 선점 재고를 자동 해제해야 한다
 * RF-011: 시스템은 결제 실패 시 선점한 재고를 복원해야 한다
 */
@Injectable()
export class OrderExpirationScheduler {
  private readonly logger = new Logger(OrderExpirationScheduler.name);

  constructor(
    private readonly orderRepository: IOrderRepository,
    private readonly orderItemRepository: IOrderItemRepository,
    private readonly productOptionRepository: IProductOptionRepository,
  ) {}

  /**
   * 만료된 주문 처리 및 재고 해제
   * 매 30초마다 실행
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async releaseExpiredOrders() {
    try {
      this.logger.log('만료된 주문 검색 시작');

      // 만료된 PENDING 주문 조회 (모든 사용자의 주문 조회)
      const allOrders: Order[] = [];
      // Repository가 findAll 메서드를 제공하지 않으므로, 임시로 여러 userId 조회
      // 실제로는 OrderRepository에 findExpiredOrders 같은 메서드가 필요
      for (let userId = 1; userId <= 1000; userId++) {
        const orders = await this.orderRepository.findManyByUserId(userId);
        allOrders.push(...orders);
      }

      const expiredOrders = allOrders.filter(
        (order) => order.status.isPending() && order.isExpired(),
      );

      if (expiredOrders.length === 0) {
        this.logger.log('만료된 주문이 없습니다');
        return;
      }

      this.logger.log(`만료된 주문 ${expiredOrders.length}건 발견`);

      // 각 주문에 대해 처리
      for (const order of expiredOrders) {
        try {
          // 1. 주문 상태를 EXPIRED로 변경
          order.expire();
          await this.orderRepository.update(order);

          // 2. 주문 상품 조회
          const orderItems = await this.orderItemRepository.findManyByOrderId(
            order.id,
          );

          // 3. 선점된 재고 해제
          for (const item of orderItems) {
            const productOption = await this.productOptionRepository.findById(
              item.productOptionId,
            );

            if (productOption) {
              productOption.releaseReservedStock(item.quantity);
              await this.productOptionRepository.update(productOption);
            }
          }

          this.logger.log(
            `주문 ID ${order.id} 만료 처리 완료 (재고 해제: ${orderItems.length}개 상품)`,
          );
        } catch (error) {
          this.logger.error(`주문 ID ${order.id} 만료 처리 실패`, error);
        }
      }

      this.logger.log(`만료된 주문 ${expiredOrders.length}건 처리 완료`);
    } catch (error) {
      this.logger.error('만료된 주문 처리 중 오류 발생', error);
    }
  }
}
