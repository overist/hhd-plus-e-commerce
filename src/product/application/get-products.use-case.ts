import { Injectable } from '@nestjs/common';
import { ProductDomainService } from '@/product/domain/services/product.service';
import { GetProductsQuery, GetProductsResult } from './dto/get-products.dto';

@Injectable()
export class GetProductsUseCase {
  constructor(private readonly productService: ProductDomainService) {}

  /**
   * ANCHOR 판매 중인 상품 목록 조회
   */
  async execute(query: GetProductsQuery): Promise<GetProductsResult[]> {
    const products = await this.productService.getProductsOnSale();

    return products.map((product) => GetProductsResult.fromDomain(product));
  }
}
