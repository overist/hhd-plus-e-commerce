import { ProductPopularitySnapshot } from '@/product/domain/entities/product-popularity-snapshot.entity';

describe('ProductPopularitySnapshot Entity', () => {
  describe('생성자', () => {
    it('유효한 값으로 ProductPopularitySnapshot을 생성한다', () => {
      // given
      const id = 1;
      const productId = 100;
      const productName = '인기 상품';
      const price = 50000;
      const category = '전자기기';
      const rank = 1;
      const salesCount = 1000;
      const lastSoldAt = new Date('2025-01-01');
      const createdAt = new Date();

      // when
      const snapshot = new ProductPopularitySnapshot(
        id,
        productId,
        productName,
        price,
        category,
        rank,
        salesCount,
        lastSoldAt,
        createdAt,
      );

      // then
      expect(snapshot.id).toBe(id);
      expect(snapshot.productId).toBe(productId);
      expect(snapshot.productName).toBe(productName);
      expect(snapshot.price).toBe(price);
      expect(snapshot.category).toBe(category);
      expect(snapshot.rank).toBe(rank);
      expect(snapshot.salesCount).toBe(salesCount);
      expect(snapshot.lastSoldAt).toBe(lastSoldAt);
      expect(snapshot.createdAt).toBe(createdAt);
    });

    it('lastSoldAt이 null인 경우에도 생성된다', () => {
      // given
      const lastSoldAt = null;

      // when
      const snapshot = new ProductPopularitySnapshot(
        1,
        100,
        '신규 상품',
        50000,
        '전자기기',
        1,
        0,
        lastSoldAt,
        new Date(),
      );

      // then
      expect(snapshot.lastSoldAt).toBeNull();
    });
  });
});
