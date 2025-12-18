import { Injectable, Logger } from '@nestjs/common';
import { OrderDomainService } from '@/order/domain/services/order.service';
import { RedisLockService } from '@common/redis-lock-manager/redis.lock.service';

// dto
import {
  ProcessPaymentCommand,
  ProcessPaymentResult,
} from './dto/process-payment.dto';
import { OrderKafkaProducer } from '@/order/infrastructure/order.kafka.producer';

@Injectable()
export class ProcessPaymentUseCase {
  private readonly logger = new Logger(ProcessPaymentUseCase.name);

  constructor(
    private readonly orderService: OrderDomainService,
    private readonly orderKafkaProducer: OrderKafkaProducer,
    private readonly redisLockService: RedisLockService,
  ) {}

  /**
   * ANCHOR 결제 처리
   *
   * UseCase 역할:
   * - 컨트롤러 요청 수신 및 결과 반환
   * - 분산락을 통한 중복 결제 방지
   * - 주문 상태 변경 및 저장
   *
   * 이벤트 흐름 제어는 애플리케이션 이벤트로 수행
   *
   * 동시성 제어:
   * - payment:order:{orderId} - 동일 주문에 대한 중복 결제 방지 (Redis 분산락)
   * - 상품 옵션별 재고 (DB 비관적 잠금 FOR UPDATE)
   * - 사용자별 잔액 (DB 낙관적 잠금 + 재시도)
   * - 쿠폰 - Redis Lua 스크립트로 원자적 처리 (CouponRedisService)
   */
  async processPayment(
    cmd: ProcessPaymentCommand,
  ): Promise<ProcessPaymentResult> {
    const lockKey = `payment:order:${cmd.orderId}`;

    return this.redisLockService.withLock(
      lockKey,
      async () => {
        // 1) 주문 조회 및 검증
        const order = await this.orderService.getOrder(cmd.orderId);
        order.validateOwnedBy(cmd.userId);

        const orderItems = await this.orderService.getOrderItems(cmd.orderId);

        // 2) 결제 처리 시작 표시 (중복 클릭 방지)
        order.beginPaymentProcessing();
        await this.orderService.updateOrder(order);

        // 3) 실제 결제 흐름은 Kafka 이벤트 체인으로 수행 (non-blocking)
        await this.orderKafkaProducer.publishOrderProcessing({
          orderId: cmd.orderId,
          userId: cmd.userId,
          couponId: cmd.couponId || null,
          items: orderItems.map((item) => ({
            productOptionId: item.productOptionId,
            productName: item.productName,
            quantity: item.quantity,
            price: item.price,
          })),
        });

        return ProcessPaymentResult.from(order);
      },
      { ttl: 10000 },
    );
  }
}
