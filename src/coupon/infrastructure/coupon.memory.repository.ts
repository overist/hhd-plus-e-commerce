import { Injectable } from '@nestjs/common';
import { Coupon } from '../domain/entities/coupon.entity';
import { UserCoupon } from '../domain/entities/user-coupon.entity';
import { ICouponRepository } from '../domain/interfaces/coupon.repository.interface';
import { IUserCouponRepository } from '../domain/interfaces/coupon.repository.interface';
import { MutexManager } from '@common/mutex-manager/mutex-manager';

/**
 * Coupon Repository Implementation (In-Memory)
 * 동시성 제어: 쿠폰별 발급 수량 증가 시 Mutex를 통한 직렬화 보장
 */
@Injectable()
export class CouponMemoryRepository implements ICouponRepository {
  private coupons: Map<number, Coupon> = new Map();
  private currentId = 1;
  private readonly mutexManager = new MutexManager();

  // ANCHOR coupon.findById
  async findById(id: number): Promise<Coupon | null> {
    return this.coupons.get(id) || null;
  }

  // ANCHOR coupon.findManyByIds
  async findManyByIds(ids: number[]): Promise<Coupon[]> {
    return ids
      .map((id) => this.coupons.get(id))
      .filter((coupon): coupon is Coupon => coupon !== undefined);
  }

  // ANCHOR coupon.findAll
  async findAll(): Promise<Coupon[]> {
    return Array.from(this.coupons.values());
  }

  // ANCHOR coupon.create
  async create(coupon: Coupon): Promise<Coupon> {
    const unlock = await this.mutexManager.acquire(0);

    try {
      const newCoupon = new Coupon(
        this.currentId++,
        coupon.name,
        coupon.discountRate,
        coupon.totalQuantity,
        coupon.issuedQuantity,
        coupon.expiredAt,
        coupon.createdAt,
        coupon.updatedAt,
      );
      this.coupons.set(newCoupon.id, newCoupon);
      return newCoupon;
    } finally {
      unlock();
    }
  }

  // ANCHOR coupon.update
  async update(coupon: Coupon): Promise<Coupon> {
    const unlock = await this.mutexManager.acquire(coupon.id);

    try {
      this.coupons.set(coupon.id, coupon);
      return coupon;
    } finally {
      unlock();
    }
  }
}

/**
 * UserCoupon Repository Implementation (In-Memory)
 */
@Injectable()
export class UserCouponRepository implements IUserCouponRepository {
  private userCoupons: Map<number, UserCoupon> = new Map();
  private currentId = 1;

  // ANCHOR userCoupon.findById
  async findById(id: number): Promise<UserCoupon | null> {
    return this.userCoupons.get(id) || null;
  }

  // ANCHOR userCoupon.findByUserId
  async findByUserId(userId: number): Promise<UserCoupon[]> {
    return Array.from(this.userCoupons.values()).filter(
      (uc) => uc.userId === userId,
    );
  }

  // ANCHOR userCoupon.findByUserCoupon
  async findByUserCoupon(
    userId: number,
    couponId: number,
  ): Promise<UserCoupon | null> {
    return (
      Array.from(this.userCoupons.values()).find(
        (uc) => uc.userId === userId && uc.couponId === couponId,
      ) || null
    );
  }

  // ANCHOR userCoupon.create
  async create(userCoupon: UserCoupon): Promise<UserCoupon> {
    const newUserCoupon = new UserCoupon(
      this.currentId++,
      userCoupon.userId,
      userCoupon.couponId,
      userCoupon.orderId,
      userCoupon.createdAt,
      userCoupon.usedAt,
      userCoupon.expiredAt,
      userCoupon.updatedAt,
    );
    this.userCoupons.set(newUserCoupon.id, newUserCoupon);
    return newUserCoupon;
  }

  // ANCHOR userCoupon.update
  async update(userCoupon: UserCoupon): Promise<UserCoupon> {
    this.userCoupons.set(userCoupon.id, userCoupon);
    return userCoupon;
  }
}
