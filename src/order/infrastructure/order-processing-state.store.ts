import { Injectable } from '@nestjs/common';
import { RedisService } from '@common/redis/redis.service';

export type OrderProcessingCoordinatorState = {
  orderId: number;
  userId: number;
  couponId: number | null;
  items: {
    productOptionId: number;
    productName: string;
    quantity: number;
    price: number;
  }[];
  stockOk: boolean;
  couponOk: boolean;
  appliedCoupon: { id: number; discountRate: number } | null;
  emitted: boolean;
};

@Injectable()
export class OrderProcessingStateStore {
  private readonly ttlSeconds = 60 * 60 * 24 * 3; // 3 days

  constructor(private readonly redisService: RedisService) {}

  private key(orderId: number): string {
    return `order:processing:state:${orderId}`;
  }

  async init(
    state: Omit<OrderProcessingCoordinatorState, 'emitted'>,
  ): Promise<void> {
    const redis = this.redisService.getClient();
    const key = this.key(state.orderId);

    await redis.hset(key, {
      orderId: String(state.orderId),
      userId: String(state.userId),
      couponId: state.couponId === null ? 'null' : String(state.couponId),
      itemsJson: JSON.stringify(state.items),
      stockOk: state.stockOk ? '1' : '0',
      couponOk: state.couponOk ? '1' : '0',
      appliedCouponJson: state.appliedCoupon
        ? JSON.stringify(state.appliedCoupon)
        : 'null',
      emitted: '0',
    });
    await redis.expire(key, this.ttlSeconds);
  }

  async clear(orderId: number): Promise<void> {
    const redis = this.redisService.getClient();
    await redis.del(this.key(orderId));
  }

  async get(orderId: number): Promise<OrderProcessingCoordinatorState | null> {
    const redis = this.redisService.getClient();
    const key = this.key(orderId);
    const data = await redis.hgetall(key);
    if (!data || Object.keys(data).length === 0) return null;

    return {
      orderId: Number(data.orderId),
      userId: Number(data.userId),
      couponId: data.couponId === 'null' ? null : Number(data.couponId),
      items: JSON.parse(data.itemsJson || '[]'),
      stockOk: data.stockOk === '1',
      couponOk: data.couponOk === '1',
      appliedCoupon:
        !data.appliedCouponJson || data.appliedCouponJson === 'null'
          ? null
          : JSON.parse(data.appliedCouponJson),
      emitted: data.emitted === '1',
    };
  }

  async markStockOk(orderId: number): Promise<boolean> {
    return this.markOkAndCheck(orderId, 'stockOk');
  }

  async markCouponOk(
    orderId: number,
    appliedCoupon: { id: number; discountRate: number },
  ): Promise<boolean> {
    return this.markOkAndCheck(orderId, 'couponOk', appliedCoupon);
  }

  private async markOkAndCheck(
    orderId: number,
    field: 'stockOk' | 'couponOk',
    appliedCoupon?: { id: number; discountRate: number },
  ): Promise<boolean> {
    const redis = this.redisService.getClient();
    const key = this.key(orderId);

    const lua = `
      local key = KEYS[1]
      local field = ARGV[1]
      local applied = ARGV[2]

      redis.call('HSET', key, field, '1')
      if applied and applied ~= '' then
        redis.call('HSET', key, 'appliedCouponJson', applied)
      end

      local stockOk = redis.call('HGET', key, 'stockOk')
      local couponOk = redis.call('HGET', key, 'couponOk')
      local emitted = redis.call('HGET', key, 'emitted')
      if not emitted then emitted = '0' end

      if stockOk == '1' and couponOk == '1' and emitted ~= '1' then
        redis.call('HSET', key, 'emitted', '1')
        return 1
      end
      return 0
    `;

    const applied = appliedCoupon ? JSON.stringify(appliedCoupon) : '';
    const result = await redis.eval(lua, 1, key, field, applied);
    return Number(result) === 1;
  }
}
