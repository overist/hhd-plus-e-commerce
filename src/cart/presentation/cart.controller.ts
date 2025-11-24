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
  Patch,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { AddCartRequestDto } from './dto/add-cart.dto';
import { GetCartResponseDto } from './dto/get-cart.dto';
import { CartDomainService } from '@/cart/domain/services/cart.service';
import { CartFacade } from '@/cart/application/cart.facade';

/**
 * Cart Controller
 * 장바구니 관리 API 엔드포인트
 */
@ApiTags('cart')
@Controller('api/users/:userId/cart')
export class CartController {
  constructor(
    private readonly cartService: CartDomainService,
    private readonly cartFacade: CartFacade,
  ) {}

  /**
   * ANCHOR 장바구니 상품 추가 (US-005)
   */
  @Post()
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
    @Body() dto: AddCartRequestDto,
  ): Promise<void> {
    return this.cartService.addCart(userId, dto.productOptionId, dto.quantity);
  }

  /**
   * ANCHOR 장바구니 조회 (US-006)
   */
  @Get()
  @ApiOperation({
    summary: '장바구니 조회',
    description: '장바구니에 담긴 상품 목록을 조회합니다.',
  })
  @ApiParam({ name: 'userId', description: '사용자 ID' })
  @ApiResponse({
    status: 200,
    description: '장바구니 조회 성공(빈 장바구니 포함)',
    type: GetCartResponseDto,
  })
  @ApiResponse({ status: 404, description: '사용자를 찾을 수 없음' })
  async getCart(
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<GetCartResponseDto> {
    const items = await this.cartFacade.getCartView(userId);
    return { items };
  }

  /**
   * ANCHOR 장바구니 상품 삭제 (US-007)
   */
  @Delete(':productOptionId')
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
    @Param('productOptionId', ParseIntPipe) productOptionId: number,
  ): Promise<void> {
    await this.cartService.removeCart(userId, productOptionId);
  }

  // TODO 장바구니 수량 수정
}
