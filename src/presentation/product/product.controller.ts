import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { ProductFacade } from '@application/facades/product.facade';
import { GetProductsResponseDto } from './dto/get-products.dto';
import { GetProductDetailResponseDto } from './dto/get-product-detail.dto';
import { GetTopProductsResponseDto } from './dto/get-top-products.dto';
import { ProductDomainService } from '@domain/product/product.service';

/**
 * Product Controller
 * 상품 조회 API 엔드포인트
 */
@ApiTags('products')
@Controller('api/products')
export class ProductController {
  constructor(
    private readonly productFacade: ProductFacade,
    private readonly productService: ProductDomainService,
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
    type: GetProductsResponseDto,
  })
  async getProducts(): Promise<GetProductsResponseDto> {
    // return await this.productService.getProductsWithFilter();

    const products = await this.productService.getProductsOnSale();

    return {
      products: products.map((product) => ({
        ...product,
        productId: product.id,
      })),
    };
  }

  /**
   * ANCHOR 상위 상품 조회 (US-003)
   * 최근 3일간 가장 많이 팔린 상위 5개 상품 조회
   */
  @Get('top')
  @ApiOperation({
    summary: '상위 상품 조회',
    description: '최근 3일간 가장 많이 팔린 상위 5개 상품을 조회합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '상위 상품 조회 성공',
    type: GetTopProductsResponseDto,
  })
  async getTopProducts(): Promise<GetTopProductsResponseDto> {
    const topProducts = await this.productService.getTopProducts(5);
    return {
      products: topProducts.map((snapshot) => ({
        ...snapshot,
        productId: snapshot.productId,
        name: snapshot.productName,
      })),
    };
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
    type: GetProductDetailResponseDto,
  })
  @ApiResponse({ status: 404, description: '상품을 찾을 수 없음' })
  async getProductDetail(
    @Param('productId', ParseIntPipe) productId: number,
  ): Promise<GetProductDetailResponseDto> {
    const productDetailView =
      await this.productFacade.getProductDetailView(productId);
    return {
      product: {
        ...productDetailView.product,
        productId: productDetailView.product.id,
      },
      options: productDetailView.options.map((option) => ({
        ...option,
        productOptionId: option.id,
      })),
    };
  }

  /**
   * ANCHOR 상품 옵션 수량 관리자 수정
   * 상품 옵션의 재고 수량을 관리자 권한으로 수정
   */
  @Patch('options/:optionId/stock')
  @ApiOperation({
    summary: '상품 옵션 재고 수량 수정',
    description: '상품 옵션의 재고 수량을 관리자 권한으로 수정합니다.',
  })
  @ApiParam({ name: 'productOptionId', description: '상품 옵션 ID' })
  @ApiResponse({
    status: 200,
    description: '상품 옵션 재고 수량 수정 성공',
  })
  @ApiResponse({ status: 404, description: '상품 옵션을 찾을 수 없음' })
  async updateStock(
    @Param('productOptionId', ParseIntPipe) productOptionId: number,
    @Body() dto: { operation: 'increase' | 'decrease'; quantity: number },
  ): Promise<void> {
    await this.productFacade.updateStock(
      productOptionId,
      dto.quantity,
      dto.operation,
    );
  }
}
