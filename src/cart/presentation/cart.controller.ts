import {
  Controller,
  Post,
  Get,
  Delete,
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
import { AddCartRequest, AddCartResponse } from './dto/add-cart.dto';
import { GetCartResponse, GetCartRequest } from './dto/get-cart.dto';
import { RemoveCartRequest, RemoveCartResponse } from './dto/remove-cart.dto';

// Use Cases
import { GetCartUseCase } from '@/cart/application/get-cart.use-case';
import { AddCartUseCase } from '@/cart/application/add-cart.use-case';
import { RemoveCartUseCase } from '@/cart/application/remove-cart.use-case';

/**
 * Cart Controller
 * 장바구니 관리 API 엔드포인트
 */
@ApiTags('cart')
@Controller('api/users/:userId/cart')
export class CartController {
  constructor(
    private readonly getCartUseCase: GetCartUseCase,
    private readonly addCartUseCase: AddCartUseCase,
    private readonly removeCartUseCase: RemoveCartUseCase,
  ) {}

  /**
   * ANCHOR 장바구니 조회 (US-006)
   */
  @Get()
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: '장바구니 조회',
    description: '장바구니에 담긴 상품 목록을 조회합니다.',
  })
  @ApiParam({ name: 'userId', description: '사용자 ID' })
  @ApiResponse({
    status: 200,
    description: '장바구니 조회 성공(빈 장바구니 포함)',
    type: GetCartResponse,
  })
  @ApiResponse({ status: 404, description: '사용자를 찾을 수 없음' })
  async getCart(
    @Param('userId', ParseIntPipe) userId: number,
    @Param() dto: GetCartRequest,
  ): Promise<GetCartResponse> {
    const query = GetCartRequest.toQuery(userId, dto);
    const result = await this.getCartUseCase.getCart(query);
    return { data: result } as GetCartResponse;
  }

  /**
   * ANCHOR 장바구니 상품 추가 (US-005)
   */
  @Post()
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '장바구니 상품 추가',
    description: '장바구니에 상품을 추가하거나 수량을 증가시킵니다.',
  })
  @ApiParam({ name: 'userId', description: '사용자 ID' })
  @ApiResponse({
    status: 201,
    description: '장바구니 추가 완료',
  })
  @ApiResponse({ status: 400, description: '재고 부족' })
  @ApiResponse({ status: 404, description: '상품 옵션을 찾을 수 없음' })
  async addCart(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: AddCartRequest,
  ): Promise<AddCartResponse> {
    const command = AddCartRequest.toCommand(userId, dto);

    return await this.addCartUseCase.addToCart(command);
  }

  /**
   * ANCHOR 장바구니 상품 삭제 (US-007)
   */
  @Delete(':productOptionId')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: '장바구니 상품 삭제',
    description: '장바구니에서 특정 상품을 삭제하거나 수량을 감소시킵니다.',
  })
  @ApiParam({ name: 'userId', description: '사용자 ID' })
  @ApiParam({ name: 'productOptionId', description: '상품 옵션 ID' })
  @ApiResponse({
    status: 204,
    description: '장바구니 항목 삭제 완료',
  })
  @ApiResponse({ status: 404, description: '장바구니 항목을 찾을 수 없음' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  async removeCart(
    @Param('userId', ParseIntPipe) userId: number,
    @Param() dto: RemoveCartRequest,
  ): Promise<RemoveCartResponse> {
    const command = RemoveCartRequest.toCommand(userId, dto);

    return await this.removeCartUseCase.removeFromCart(command);
  }

  // TODO 장바구니 수량 수정
}
