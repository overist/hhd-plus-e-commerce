import { Injectable } from '@nestjs/common';
import { ProductDomainService } from '@/product/domain/services/product.service';
import {
  GetTopProductsQuery,
  GetTopProductsResult,
} from './dto/get-top-products.dto';

@Injectable()
export class GetTopProductsUseCase {
  constructor(private readonly productService: ProductDomainService) {}

  /**
   * ANCHOR 인기 상품 조회
   */
  async execute(query: GetTopProductsQuery): Promise<GetTopProductsResult[]> {
    const topProducts = await this.productService.getTopProducts(query.count);

    return topProducts.map((snapshot) =>
      GetTopProductsResult.fromDomain(snapshot),
    );
  }
}
