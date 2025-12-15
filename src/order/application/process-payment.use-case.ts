import { Injectable, Logger } from '@nestjs/common';
import { OrderDomainService } from '@/order/domain/services/order.service';
import { RedisLockService } from '@common/redis-lock-manager/redis.lock.service';

// dto
import {
  ProcessPaymentCommand,
  ProcessPaymentResult,
} from './dto/process-payment.dto';

// orchestrator
import { PaymentOrchestrator } from './orchestrators/payment.orchestrator';

@Injectable()
export class ProcessPaymentUseCase {
  private readonly logger = new Logger(ProcessPaymentUseCase.name);

  constructor(
    private readonly orderService: OrderDomainService,
    private readonly paymentOrchestrator: PaymentOrchestrator,
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
   * 이벤트 흐름 제어는 PaymentOrchestrator에 위임
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
        // 1. 주문 조회 및 검증
        const order = await this.orderService.getOrder(cmd.orderId);
        const orderItems = await this.orderService.getOrderItems(cmd.orderId);
        order.validateOwnedBy(cmd.userId);
        order.pay();

        // 2. 결제 오케스트레이션 실행 (이벤트 흐름 제어 위임)
        const { user } = await this.paymentOrchestrator.runOrderProcess(
          cmd.orderId,
          cmd.userId,
          cmd.couponId || null,
          order,
          orderItems,
        );

        // 3. 주문 저장 (참조형으로 전달된 객체가 이벤트에 의해 이미 변경됨)
        await this.orderService.updateOrder(order);

        return ProcessPaymentResult.from(order, user);
      },
      { ttl: 10000 },
    );
  }
}
