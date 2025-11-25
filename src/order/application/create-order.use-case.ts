import { Injectable } from '@nestjs/common';
import { OrderDomainService } from '@/order/domain/services/order.service';
import { ProductDomainService } from '@/product/domain/services/product.service';
import { UserDomainService } from '@/user/domain/services/user.service';
import { PrismaService } from '@common/prisma-manager/prisma.service';
import { CreateOrderCommand, CreateOrderResult } from './dto/create-order.dto';

@Injectable()
export class CreateOrderUseCase {
  constructor(
    private readonly orderService: OrderDomainService,
    private readonly productService: ProductDomainService,
    private readonly userService: UserDomainService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * ANCHOR 주문 생성
   * 트랜잭션으로 재고 선점 + 주문 생성을 원자적으로 처리
   */
  async execute(cmd: CreateOrderCommand): Promise<CreateOrderResult> {
    return await this.prisma.runInTransaction(async () => {
      // 사용자 존재 확인
      await this.userService.getUser(cmd.userId);

      // 상품 정보 조회 및 재고 선점
      const orderItemsData = await this.productService.reserveProductsForOrder(
        cmd.items,
      );

      // 총액 계산
      const totalAmount = orderItemsData.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      );

      // 주문 생성
      const order = await this.orderService.createPendingOrder(
        cmd.userId,
        totalAmount,
      );

      // 주문 항목 생성
      const orderItems = await this.orderService.createOrderItems(
        order.id,
        orderItemsData,
      );

      return CreateOrderResult.fromDomain(order, orderItems);
    });
  }
}
