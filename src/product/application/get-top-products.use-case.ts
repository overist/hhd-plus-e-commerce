import { Injectable } from '@nestjs/common';
import { ProductDomainService } from '@/product/domain/services/product.service';
import { OrderDomainService } from '@/order/domain/services/order.service';
import {
  GetTopProductsQuery,
  GetTopProductsResult,
} from './dto/get-top-products.dto';

@Injectable()
export class GetTopProductsUseCase {
  constructor(
    private readonly orderService: OrderDomainService,
    private readonly productService: ProductDomainService,
  ) {}

  /**
   * ANCHOR 인기 상품 조회
   * Redis에서 N일간 판매 랭킹을 조회하고 상품 정보와 매핑하여 반환
   */
  async execute(query: GetTopProductsQuery): Promise<GetTopProductsResult[]> {
    // 1. Redis에서 N일간 판매 랭킹 조회
    const salesRankings = await this.orderService.getSalesRankingDays(
      query.count,
      query.dateRangeDays,
    );

    if (salesRankings.length === 0) {
      return [];
    }

    // 2. productOptionId로 상품 옵션 정보 조회
    const productOptionIds = salesRankings.map((r) => r.productOptionId);
    const productOptions =
      await this.productService.getProductOptionsByIds(productOptionIds);
    const optionMap = new Map(productOptions.map((o) => [o.id, o]));

    // 3. 상품 정보 조회
    const productIds = [...new Set(productOptions.map((o) => o.productId))];
    const products = await this.productService.getProductsByIds(productIds);
    const productMap = new Map(products.map((p) => [p.id, p]));

    // 4. 랭킹 순서대로 결과 생성
    return salesRankings
      .map((ranking, index) => {
        const option = optionMap.get(ranking.productOptionId);
        if (!option) return null;

        const product = productMap.get(option.productId);
        if (!product) return null;

        const result = new GetTopProductsResult();
        result.rank = index + 1;
        result.productId = product.id;
        result.name = product.name;
        result.price = product.price;
        result.category = product.category;
        result.salesCount = ranking.salesCount;
        return result;
      })
      .filter((r): r is GetTopProductsResult => r !== null);
  }
}
