import { RedisService } from '@common/redis/redis.service';
import {
  setupRedisForTest,
  getRedisService,
  teardownIntegrationTest,
} from '../setup';

/**
 * 인기상품 랭킹 Redis 통합 테스트
 * - Redis Sorted Set (ZSET) 기반 판매량 집계 및 조회
 * - ZINCRBY: 판매량 증가
 * - ZREVRANGE: 랭킹 조회 (점수 내림차순)
 */
describe('Sales Ranking Redis Integration Tests', () => {
  let redisService: RedisService;
  const SALES_RANKING_PREFIX = 'data:products:sales-rank';

  beforeAll(async () => {
    await setupRedisForTest();
    redisService = getRedisService();
  }, 60000);

  afterAll(async () => {
    await teardownIntegrationTest();
  });

  beforeEach(async () => {
    // 테스트 간 키 정리
    const client = redisService.getClient();
    const keys = await client.keys(`${SALES_RANKING_PREFIX}:*`);
    if (keys.length > 0) {
      await client.del(...keys);
    }
  });

  /**
   * Helper: YYYYMMDD 형식의 날짜 문자열 생성
   */
  function formatDate(date: Date): string {
    return date.toISOString().split('T')[0].replace(/-/g, '');
  }

  /**
   * Helper: 판매량 기록 (recordSales 로직 시뮬레이션)
   */
  async function recordSales(
    items: Array<{ productOptionId: number; quantity: number }>,
    date: Date = new Date(),
  ): Promise<void> {
    const YYYYMMDD = formatDate(date);
    const key = `${SALES_RANKING_PREFIX}:${YYYYMMDD}`;
    const client = redisService.getClient();

    await Promise.all(
      items.map((item) =>
        client.zincrby(key, item.quantity, item.productOptionId.toString()),
      ),
    );
  }

  /**
   * Helper: 날짜별 랭킹 조회 (findRankByDate 로직 시뮬레이션)
   */
  async function findRankByDate(
    YYYYMMDD: string,
  ): Promise<Array<{ productOptionId: number; salesCount: number }>> {
    const key = `${SALES_RANKING_PREFIX}:${YYYYMMDD}`;
    const client = redisService.getClient();
    const results = await client.zrevrange(key, 0, -1, 'WITHSCORES');

    const rankings: Array<{ productOptionId: number; salesCount: number }> = [];
    for (let i = 0; i < results.length; i += 2) {
      rankings.push({
        productOptionId: Number(results[i]),
        salesCount: Number(results[i + 1]),
      });
    }
    return rankings;
  }

  /**
   * Helper: N일간 랭킹 집계 (getSalesRankingDays 로직 시뮬레이션)
   */
  async function getSalesRankingDays(
    count: number,
    days: number = 3,
  ): Promise<Array<{ productOptionId: number; salesCount: number }>> {
    const aggregateMap = new Map<number, number>();

    const rankPromises: Promise<
      Array<{ productOptionId: number; salesCount: number }>
    >[] = [];

    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const YYYYMMDD = formatDate(date);
      rankPromises.push(findRankByDate(YYYYMMDD));
    }

    const ranks = await Promise.all(rankPromises);

    for (const rank of ranks) {
      for (const { productOptionId, salesCount } of rank) {
        const currentCount = aggregateMap.get(productOptionId) || 0;
        aggregateMap.set(productOptionId, currentCount + salesCount);
      }
    }

    const aggregatedRanks = Array.from(aggregateMap.entries()).map(
      ([productOptionId, salesCount]) => ({ productOptionId, salesCount }),
    );

    aggregatedRanks.sort((a, b) => b.salesCount - a.salesCount);

    return aggregatedRanks.slice(0, count);
  }

  describe('ZINCRBY - 판매량 집계', () => {
    it('상품 옵션의 판매량을 증가시킨다', async () => {
      // Given
      const productOptionId = 1;
      const quantity = 5;
      const today = new Date();

      // When
      await recordSales([{ productOptionId, quantity }], today);

      // Then
      const rankings = await findRankByDate(formatDate(today));
      expect(rankings).toHaveLength(1);
      expect(rankings[0]).toEqual({
        productOptionId: 1,
        salesCount: 5,
      });
    });

    it('동일 상품의 판매량이 누적된다', async () => {
      // Given
      const productOptionId = 1;
      const today = new Date();

      // When: 여러 번 판매량 기록
      await recordSales([{ productOptionId, quantity: 3 }], today);
      await recordSales([{ productOptionId, quantity: 7 }], today);
      await recordSales([{ productOptionId, quantity: 5 }], today);

      // Then: 합계 15
      const rankings = await findRankByDate(formatDate(today));
      expect(rankings).toHaveLength(1);
      expect(rankings[0].salesCount).toBe(15);
    });

    it('여러 상품 옵션의 판매량을 동시에 기록한다', async () => {
      // Given
      const today = new Date();
      const items = [
        { productOptionId: 1, quantity: 10 },
        { productOptionId: 2, quantity: 20 },
        { productOptionId: 3, quantity: 15 },
      ];

      // When
      await recordSales(items, today);

      // Then: 판매량 내림차순 정렬
      const rankings = await findRankByDate(formatDate(today));
      expect(rankings).toHaveLength(3);
      expect(rankings[0]).toEqual({ productOptionId: 2, salesCount: 20 });
      expect(rankings[1]).toEqual({ productOptionId: 3, salesCount: 15 });
      expect(rankings[2]).toEqual({ productOptionId: 1, salesCount: 10 });
    });

    it('날짜별로 별도의 키에 저장된다', async () => {
      // Given
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      // When
      await recordSales([{ productOptionId: 1, quantity: 10 }], today);
      await recordSales([{ productOptionId: 1, quantity: 5 }], yesterday);

      // Then: 각 날짜별로 별도 저장
      const todayRankings = await findRankByDate(formatDate(today));
      const yesterdayRankings = await findRankByDate(formatDate(yesterday));

      expect(todayRankings[0].salesCount).toBe(10);
      expect(yesterdayRankings[0].salesCount).toBe(5);
    });
  });

  describe('ZREVRANGE - 랭킹 조회', () => {
    it('판매량 내림차순으로 정렬된 결과를 반환한다', async () => {
      // Given
      const today = new Date();
      await recordSales(
        [
          { productOptionId: 1, quantity: 100 },
          { productOptionId: 2, quantity: 500 },
          { productOptionId: 3, quantity: 300 },
          { productOptionId: 4, quantity: 200 },
          { productOptionId: 5, quantity: 400 },
        ],
        today,
      );

      // When
      const rankings = await findRankByDate(formatDate(today));

      // Then: 500 > 400 > 300 > 200 > 100 순서
      expect(rankings.map((r) => r.productOptionId)).toEqual([2, 5, 3, 4, 1]);
      expect(rankings.map((r) => r.salesCount)).toEqual([
        500, 400, 300, 200, 100,
      ]);
    });

    it('데이터가 없는 경우 빈 배열을 반환한다', async () => {
      // Given: 데이터 없음

      // When
      const rankings = await findRankByDate('99991231');

      // Then
      expect(rankings).toEqual([]);
    });

    it('동일 판매량일 경우에도 정상적으로 조회된다', async () => {
      // Given
      const today = new Date();
      await recordSales(
        [
          { productOptionId: 1, quantity: 100 },
          { productOptionId: 2, quantity: 100 },
          { productOptionId: 3, quantity: 100 },
        ],
        today,
      );

      // When
      const rankings = await findRankByDate(formatDate(today));

      // Then: 모두 같은 판매량
      expect(rankings).toHaveLength(3);
      expect(rankings.every((r) => r.salesCount === 100)).toBe(true);
    });
  });

  describe('N일간 집계 조회', () => {
    it('3일간 판매량을 합산하여 반환한다', async () => {
      // Given
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      // 상품1: 10 + 20 + 30 = 60
      // 상품2: 15 + 25 + 35 = 75
      await recordSales(
        [
          { productOptionId: 1, quantity: 10 },
          { productOptionId: 2, quantity: 15 },
        ],
        today,
      );
      await recordSales(
        [
          { productOptionId: 1, quantity: 20 },
          { productOptionId: 2, quantity: 25 },
        ],
        yesterday,
      );
      await recordSales(
        [
          { productOptionId: 1, quantity: 30 },
          { productOptionId: 2, quantity: 35 },
        ],
        twoDaysAgo,
      );

      // When
      const rankings = await getSalesRankingDays(5, 3);

      // Then
      expect(rankings).toHaveLength(2);
      expect(rankings[0]).toEqual({ productOptionId: 2, salesCount: 75 });
      expect(rankings[1]).toEqual({ productOptionId: 1, salesCount: 60 });
    });

    it('Top N개만 반환한다', async () => {
      // Given
      const today = new Date();
      await recordSales(
        [
          { productOptionId: 1, quantity: 100 },
          { productOptionId: 2, quantity: 200 },
          { productOptionId: 3, quantity: 300 },
          { productOptionId: 4, quantity: 400 },
          { productOptionId: 5, quantity: 500 },
        ],
        today,
      );

      // When: Top 3만 요청
      const rankings = await getSalesRankingDays(3, 1);

      // Then
      expect(rankings).toHaveLength(3);
      expect(rankings[0].productOptionId).toBe(5);
      expect(rankings[1].productOptionId).toBe(4);
      expect(rankings[2].productOptionId).toBe(3);
    });

    it('일부 날짜에만 데이터가 있어도 정상 집계된다', async () => {
      // Given: 오늘만 데이터 있음
      const today = new Date();
      await recordSales(
        [
          { productOptionId: 1, quantity: 50 },
          { productOptionId: 2, quantity: 30 },
        ],
        today,
      );

      // When: 3일 집계 (어제, 그저께는 데이터 없음)
      const rankings = await getSalesRankingDays(5, 3);

      // Then: 오늘 데이터만 반영
      expect(rankings).toHaveLength(2);
      expect(rankings[0]).toEqual({ productOptionId: 1, salesCount: 50 });
      expect(rankings[1]).toEqual({ productOptionId: 2, salesCount: 30 });
    });

    it('7일간 판매량을 집계할 수 있다', async () => {
      // Given: 7일치 데이터
      for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        await recordSales([{ productOptionId: 1, quantity: 10 }], date);
      }

      // When
      const rankings = await getSalesRankingDays(5, 7);

      // Then: 10 * 7 = 70
      expect(rankings).toHaveLength(1);
      expect(rankings[0].salesCount).toBe(70);
    });
  });

  describe('동시성 테스트', () => {
    it('동시에 여러 판매량을 기록해도 정확히 집계된다', async () => {
      // Given
      const today = new Date();
      const productOptionId = 1;
      const concurrentCount = 100;
      const quantityPerRequest = 1;

      // When: 100개의 동시 요청
      await Promise.all(
        Array.from({ length: concurrentCount }, () =>
          recordSales(
            [{ productOptionId, quantity: quantityPerRequest }],
            today,
          ),
        ),
      );

      // Then: 정확히 100개 집계
      const rankings = await findRankByDate(formatDate(today));
      expect(rankings[0].salesCount).toBe(concurrentCount);
    });

    it('여러 상품에 대한 동시 요청이 정확히 처리된다', async () => {
      // Given
      const today = new Date();
      const productCount = 10;
      const requestsPerProduct = 10;

      // When: 각 상품별 10번씩 동시 요청 (총 100개)
      const promises: Promise<void>[] = [];
      for (let productId = 1; productId <= productCount; productId++) {
        for (let i = 0; i < requestsPerProduct; i++) {
          promises.push(
            recordSales([{ productOptionId: productId, quantity: 1 }], today),
          );
        }
      }
      await Promise.all(promises);

      // Then: 각 상품당 정확히 10개씩
      const rankings = await findRankByDate(formatDate(today));
      expect(rankings).toHaveLength(productCount);
      expect(rankings.every((r) => r.salesCount === requestsPerProduct)).toBe(
        true,
      );
    });
  });

  describe('성능 테스트', () => {
    it('대량 데이터 기록 성능 테스트', async () => {
      // Given
      const today = new Date();
      const itemCount = 1000;
      const items = Array.from({ length: itemCount }, (_, i) => ({
        productOptionId: i + 1,
        quantity: Math.floor(Math.random() * 100) + 1,
      }));

      // When
      const startTime = Date.now();
      await recordSales(items, today);
      const writeTime = Date.now() - startTime;

      // Then: 1000개 기록이 합리적인 시간 내 완료 (1초 미만)
      console.log(`1000개 상품 판매량 기록 시간: ${writeTime}ms`);
      expect(writeTime).toBeLessThan(1000);
    });

    it('대량 데이터 조회 성능 테스트', async () => {
      // Given
      const today = new Date();
      const itemCount = 1000;
      const items = Array.from({ length: itemCount }, (_, i) => ({
        productOptionId: i + 1,
        quantity: Math.floor(Math.random() * 100) + 1,
      }));
      await recordSales(items, today);

      // When
      const startTime = Date.now();
      const rankings = await findRankByDate(formatDate(today));
      const readTime = Date.now() - startTime;

      // Then: 1000개 조회가 합리적인 시간 내 완료 (100ms 미만)
      console.log(`1000개 상품 랭킹 조회 시간: ${readTime}ms`);
      expect(readTime).toBeLessThan(100);
      expect(rankings).toHaveLength(itemCount);
    });

    it('7일 집계 조회 성능 테스트', async () => {
      // Given: 7일치 각 100개 상품 데이터
      for (let day = 0; day < 7; day++) {
        const date = new Date();
        date.setDate(date.getDate() - day);
        const items = Array.from({ length: 100 }, (_, i) => ({
          productOptionId: i + 1,
          quantity: Math.floor(Math.random() * 50) + 1,
        }));
        await recordSales(items, date);
      }

      // When
      const startTime = Date.now();
      const rankings = await getSalesRankingDays(10, 7);
      const aggregateTime = Date.now() - startTime;

      // Then: 7일 집계가 합리적인 시간 내 완료 (200ms 미만)
      console.log(`7일간 Top 10 집계 시간: ${aggregateTime}ms`);
      expect(aggregateTime).toBeLessThan(200);
      expect(rankings).toHaveLength(10);
    });
  });
});
