import { ProductPopularitySnapshot } from '@/product/domain/entities/product-popularity-snapshot.entity';

/**
 * 애플리케이션 레이어 DTO: GetTopProducts 요청
 */
export class GetTopProductsQuery {
  count: number;
  dateRangeDays: number;
}

/**
 * 애플리케이션 레이어 DTO: GetTopProducts 응답
 */
export class GetTopProductsResult {
  rank: number;
  productId: number;
  name: string;
  price: number;
  category: string;
  salesCount: number;

  static fromDomain(snapshot: ProductPopularitySnapshot): GetTopProductsResult {
    const dto = new GetTopProductsResult();
    dto.rank = snapshot.rank;
    dto.productId = snapshot.productId;
    dto.name = snapshot.productName;
    dto.price = snapshot.price;
    dto.category = snapshot.category;
    dto.salesCount = snapshot.salesCount;
    return dto;
  }
}
