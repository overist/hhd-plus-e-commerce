/**
 * ProductSalesRanking Value Object
 * 상품 옵션별 판매량 랭킹 정보를 담는 값 객체
 */
export class ProductSalesRanking {
  constructor(
    public readonly productOptionId: number,
    public readonly salesCount: number,
  ) {}
}
