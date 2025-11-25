/**
 * ProductPopularitySnapshot Entity
 * 인기 상품 캐시 (배치로 생성)
 */
export class ProductPopularitySnapshot {
  constructor(
    public readonly id: number,
    public readonly productId: number,
    public readonly productName: string,
    public readonly price: number,
    public readonly category: string,
    public readonly rank: number,
    public readonly salesCount: number,
    public readonly lastSoldAt: Date | null,
    public readonly createdAt: Date,
  ) {}

  // static create(
  //   productId: number,
  //   productName: string,
  //   price: number,
  //   category: string,
  //   rank: number,
  //   salesCount: number,
  //   lastSoldAt: Date | null,
  // ): ProductPopularitySnapshot {
  //   const now = new Date();
  //   return new ProductPopularitySnapshot(
  //     0,
  //     productId,
  //     productName,
  //     price,
  //     category,
  //     rank,
  //     salesCount,
  //     lastSoldAt,
  //     now,
  //   );
  // }
}
