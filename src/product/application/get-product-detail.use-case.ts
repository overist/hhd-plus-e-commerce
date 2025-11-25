import { Injectable } from '@nestjs/common';
import { ProductDomainService } from '@/product/domain/services/product.service';
import {
  GetProductDetailQuery,
  GetProductDetailResult,
} from './dto/get-product-detail.dto';

@Injectable()
export class GetProductDetailUseCase {
  constructor(private readonly productService: ProductDomainService) {}

  /**
   * ANCHOR 상품 상세 및 옵션 조회
   */
  async execute(query: GetProductDetailQuery): Promise<GetProductDetailResult> {
    const product = await this.productService.getProduct(query.productId);
    const options = await this.productService.getProductOptions(
      query.productId,
    );

    return GetProductDetailResult.fromDomain(product, options);
  }
}
