import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { OrderFacade } from '@/order/application/order.facade';
import {
  CreateOrderRequestDto,
  CreateOrderResponseDto,
} from './dto/create-order.dto';
import {
  ProcessPaymentRequestDto,
  ProcessPaymentResponseDto,
} from './dto/process-payment.dto';
import {
  GetOrdersResponseDto,
  GetOrderDetailResponseDto,
} from './dto/get-orders.dto';
import { OrderDomainService } from '@/order/domain/services/order.service';

/**
 * Order Controller
 * 주문/결제 API 엔드포인트
 */
@ApiTags('orders')
@Controller('api')
export class OrderController {
  constructor(
    private readonly orderFacade: OrderFacade,
    private readonly orderService: OrderDomainService,
  ) {}

  /**
   * 주문서 생성 (US-008)
   */
  @Post('orders')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '주문서 생성',
    description: '주문서를 생성하고 재고를 임시 선점합니다.',
  })
  @ApiResponse({
    status: 201,
    description: '주문서 생성 완료',
    type: CreateOrderResponseDto,
  })
  @ApiResponse({ status: 400, description: '재고 부족' })
  @ApiResponse({ status: 404, description: '사용자 또는 상품을 찾을 수 없음' })
  async createOrder(
    @Body() dto: CreateOrderRequestDto,
  ): Promise<CreateOrderResponseDto> {
    const orderCreateView = await this.orderFacade.createOrder(
      dto.userId,
      dto.items,
    );
    return orderCreateView;
  }

  /**
   * 결제 처리 (US-009)
   */
  @Post('orders/:orderId/payment')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '결제 처리',
    description: '주문에 대한 결제를 처리합니다.',
  })
  @ApiParam({ name: 'orderId', description: '주문 ID' })
  @ApiResponse({
    status: 200,
    description: '결제 완료',
    type: ProcessPaymentResponseDto,
  })
  @ApiResponse({ status: 400, description: '잔액 부족 또는 주문서 만료' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  @ApiResponse({ status: 404, description: '주문을 찾을 수 없음' })
  async processPayment(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() dto: ProcessPaymentRequestDto,
  ): Promise<ProcessPaymentResponseDto> {
    const paymentView = await this.orderFacade.processPayment(
      orderId,
      dto.userId,
      dto.userCouponId,
    );
    return paymentView;
  }

  /**
   * 주문 내역 조회 (US-012)
   */
  @Get('users/:userId/orders')
  @ApiOperation({
    summary: '주문 내역 조회',
    description: '사용자의 주문 내역을 조회합니다.',
  })
  @ApiParam({ name: 'userId', description: '사용자 ID' })
  @ApiResponse({
    status: 200,
    description: '주문 내역 조회 성공',
    type: GetOrdersResponseDto,
  })
  @ApiResponse({ status: 404, description: '사용자를 찾을 수 없음' })
  async getOrdersByUser(
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<GetOrdersResponseDto> {
    const orderListView = await this.orderFacade.getOrders(userId);
    return { orders: orderListView };
  }

  /**
   * 주문 상세 조회
   */
  @Get('orders/:orderId')
  @ApiOperation({
    summary: '주문 상세 조회',
    description: '특정 주문의 상세 정보를 조회합니다.',
  })
  @ApiParam({ name: 'orderId', description: '주문 ID' })
  @ApiResponse({
    status: 200,
    description: '주문 상세 조회 성공',
    type: GetOrderDetailResponseDto,
  })
  @ApiResponse({ status: 404, description: '주문을 찾을 수 없음' })
  async getOrderDetail(
    @Param('orderId', ParseIntPipe) orderId: number,
  ): Promise<GetOrderDetailResponseDto> {
    const orderDetailView = await this.orderFacade.getOrderDetail(orderId);
    return { orderDetail: orderDetailView };
  }
}
