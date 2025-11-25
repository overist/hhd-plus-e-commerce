import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { AuthGuard } from '@common/guards/auth.guard';

// DTOs
import {
  CreateOrderRequest,
  CreateOrderResponse,
} from './dto/create-order.dto';
import {
  ProcessPaymentRequest,
  ProcessPaymentResponse,
} from './dto/process-payment.dto';
import {
  GetOrdersRequest,
  GetOrdersResponse,
  GetOrderDetailRequest,
  GetOrderDetailResponse,
} from './dto/get-orders.dto';

// Use Cases
import { CreateOrderUseCase } from '@/order/application/create-order.use-case';
import { ProcessPaymentUseCase } from '@/order/application/process-payment.use-case';
import { GetOrdersUseCase } from '@/order/application/get-orders.use-case';
import { GetOrderDetailUseCase } from '@/order/application/get-order-detail.use-case';

/**
 * Order Controller
 * 주문/결제 API 엔드포인트
 */
@ApiTags('orders')
@Controller('api')
export class OrderController {
  constructor(
    private readonly createOrderUseCase: CreateOrderUseCase,
    private readonly processPaymentUseCase: ProcessPaymentUseCase,
    private readonly getOrdersUseCase: GetOrdersUseCase,
    private readonly getOrderDetailUseCase: GetOrderDetailUseCase,
  ) {}

  /**
   * ANCHOR 주문서 생성 (US-008)
   */
  @Post('orders')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '주문서 생성',
    description: '주문서를 생성하고 재고를 임시 선점합니다.',
  })
  @ApiResponse({
    status: 201,
    description: '주문서 생성 완료',
    type: CreateOrderResponse,
  })
  @ApiResponse({ status: 400, description: '재고 부족' })
  @ApiResponse({ status: 404, description: '사용자 또는 상품을 찾을 수 없음' })
  async createOrder(
    @Body() dto: CreateOrderRequest,
  ): Promise<CreateOrderResponse> {
    const command = CreateOrderRequest.toCommand(dto);
    const result = await this.createOrderUseCase.execute(command);

    return CreateOrderResponse.fromResult(result);
  }

  /**
   * ANCHOR 결제 처리 (US-009)
   */
  @Post('orders/:orderId/payment')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '결제 처리',
    description: '주문에 대한 결제를 처리합니다.',
  })
  @ApiParam({ name: 'orderId', description: '주문 ID' })
  @ApiResponse({
    status: 200,
    description: '결제 완료',
    type: ProcessPaymentResponse,
  })
  @ApiResponse({ status: 400, description: '잔액 부족 또는 주문서 만료' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  @ApiResponse({ status: 404, description: '주문을 찾을 수 없음' })
  async processPayment(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() dto: ProcessPaymentRequest,
  ): Promise<ProcessPaymentResponse> {
    const command = ProcessPaymentRequest.toCommand(orderId, dto);
    const result = await this.processPaymentUseCase.execute(command);

    return ProcessPaymentResponse.fromResult(result);
  }

  /**
   * ANCHOR 주문 내역 조회 (US-012)
   */
  @Get('users/:userId/orders')
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: '주문 내역 조회',
    description: '사용자의 주문 내역을 조회합니다.',
  })
  @ApiParam({ name: 'userId', description: '사용자 ID' })
  @ApiResponse({
    status: 200,
    description: '주문 내역 조회 성공',
    type: GetOrdersResponse,
  })
  @ApiResponse({ status: 404, description: '사용자를 찾을 수 없음' })
  async getOrdersByUser(
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<GetOrdersResponse> {
    const query = GetOrdersRequest.toQuery(userId);
    const result = await this.getOrdersUseCase.execute(query);

    return GetOrdersResponse.fromResult(result);
  }

  /**
   * ANCHOR 주문 상세 조회
   */
  @Get('orders/:orderId')
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: '주문 상세 조회',
    description: '특정 주문의 상세 정보를 조회합니다.',
  })
  @ApiParam({ name: 'orderId', description: '주문 ID' })
  @ApiResponse({
    status: 200,
    description: '주문 상세 조회 성공',
    type: GetOrderDetailResponse,
  })
  @ApiResponse({ status: 404, description: '주문을 찾을 수 없음' })
  async getOrderDetail(
    @Param('orderId', ParseIntPipe) orderId: number,
  ): Promise<GetOrderDetailResponse> {
    const query = GetOrderDetailRequest.toQuery(orderId);
    const result = await this.getOrderDetailUseCase.execute(query);

    return GetOrderDetailResponse.fromResult(result);
  }
}
