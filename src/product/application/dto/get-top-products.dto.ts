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
}
