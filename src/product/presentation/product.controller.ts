import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  UseGuards,
  UseInterceptors,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { CacheKey, CacheTTL } from '@nestjs/cache-manager';
import { HttpCacheInterceptor } from '@common/cache-manager/http-cache.interceptor';
import {
  CACHE_KEYS,
  CACHE_TTL,
  withJitter,
} from '@common/cache-manager/cache.keys';
import { AdminGuard } from '@common/guards/admin.guard';

// DTOs
import {
  GetProductsRequest,
  GetProductsResponse,
} from './dto/get-products.dto';
import {
  GetProductDetailRequest,
  GetProductDetailResponse,
} from './dto/get-product-detail.dto';
import {
  GetTopProductsRequest,
  GetTopProductsResponse,
} from './dto/get-top-products.dto';
import {
  UpdateStockRequest,
  UpdateStockResponse,
} from './dto/update-stock.dto';

// Use Cases
import { GetProductsUseCase } from '@/product/application/get-products.use-case';
import { GetProductDetailUseCase } from '@/product/application/get-product-detail.use-case';
import { GetTopProductsUseCase } from '@/product/application/get-top-products.use-case';
import { UpdateStockUseCase } from '@/product/application/update-stock.use-case';

/**
 * Product Controller
 * 상품 조회 API 엔드포인트
 */
@ApiTags('products')
@Controller('api/products')
export class ProductController {
  constructor(
    private readonly getProductsUseCase: GetProductsUseCase,
    private readonly getProductDetailUseCase: GetProductDetailUseCase,
    private readonly getTopProductsUseCase: GetTopProductsUseCase,
    private readonly updateStockUseCase: UpdateStockUseCase,
  ) {}

  /**
   * ANCHOR 상품 목록 조회 (US-001)
   * TODO: 필터링, 페이징 기능 추가
   */
  @Get()
  @ApiOperation({
    summary: '상품 목록 조회',
    description: '판매 중인 상품 목록을 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '상품 목록 조회 성공',
    type: GetProductsResponse,
  })
  async getProducts(): Promise<GetProductsResponse> {
    const query = GetProductsRequest.toQuery();
    const result = await this.getProductsUseCase.execute(query);

    return { data: result };
  }

  /**
   * ANCHOR 상위 상품 조회 (US-003)
   * 최근 3일간 가장 많이 팔린 상위 5개 상품 조회
   */
  @Get('top')
  @UseInterceptors(HttpCacheInterceptor)
  @CacheKey(CACHE_KEYS.PRODUCTS_TOP)
  @CacheTTL(withJitter(CACHE_TTL.ONE_DAY))
  @ApiOperation({
    summary: '상위 상품 조회',
    description: '최근 3일간 가장 많이 팔린 상위 5개 상품을 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '상위 상품 조회 성공',
    type: GetTopProductsResponse,
  })
  async getTopProducts(): Promise<GetTopProductsResponse> {
    const query = GetTopProductsRequest.toQuery(5);
    const result = await this.getTopProductsUseCase.execute(query);

    return { data: result };
  }

  /**
   * ANCHOR 상품 상세 조회 (US-002)
   * 특정 상품의 상세 정보 및 옵션 조회
   */
  @Get(':productId')
  @ApiOperation({
    summary: '상품 상세 조회',
    description: '특정 상품의 상세 정보를 조회합니다.',
  })
  @ApiParam({ name: 'productId', description: '상품 ID' })
  @ApiResponse({
    status: 200,
    description: '상품 상세 조회 성공',
    type: GetProductDetailResponse,
  })
  @ApiResponse({ status: 404, description: '상품을 찾을 수 없음' })
  async getProductDetail(
    @Param('productId', ParseIntPipe) productId: number,
  ): Promise<GetProductDetailResponse> {
    const query = GetProductDetailRequest.toQuery(productId);
    const result = await this.getProductDetailUseCase.execute(query);

    return { data: result };
  }

  /**
   * ANCHOR 상품 옵션 수량 관리자 수정
   * 상품 옵션의 재고 수량을 관리자 권한으로 수정
   */
  @Patch('options/:optionId/stock')
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '상품 옵션 재고 수량 수정',
    description: '상품 옵션의 재고 수량을 관리자 권한으로 수정합니다.',
  })
  @ApiParam({ name: 'optionId', description: '상품 옵션 ID' })
  @ApiResponse({
    status: 200,
    description: '상품 옵션 재고 수량 수정 성공',
  })
  @ApiResponse({ status: 404, description: '상품 옵션을 찾을 수 없음' })
  async updateStock(
    @Param('optionId', ParseIntPipe) optionId: number,
    @Body() dto: UpdateStockRequest,
  ): Promise<UpdateStockResponse> {
    const command = UpdateStockRequest.toCommand(optionId, dto);

    return await this.updateStockUseCase.execute(command);
  }
}
