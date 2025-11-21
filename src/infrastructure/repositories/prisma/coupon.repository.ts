import { Injectable } from '@nestjs/common';
import {
  ICouponRepository,
  IUserCouponRepository,
} from '@domain/interfaces/coupon.repository.interface';
import { Coupon } from '@domain/coupon/coupon.entity';
import { UserCoupon } from '@domain/coupon/user-coupon.entity';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@infrastructure/prisma/prisma.service';

/**
 * Coupon Repository Implementation (Prisma)
 * 동시성 제어: 트랜잭션 컨텍스트에서 FOR UPDATE를 통한 비관적 잠금
 */
@Injectable()
export class CouponRepository implements ICouponRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get prismaClient(): Prisma.TransactionClient | PrismaService {
    return this.prisma.getClient();
  }

  // ANCHOR coupon.findById
  async findById(id: number): Promise<Coupon | null> {
    const tx = this.prisma.getTransactionClient();

    // 트랜잭션 컨텍스트가 있으면 FOR UPDATE 사용
    if (tx) {
      const recordList: any[] =
        await tx.$queryRaw`SELECT * FROM coupons WHERE id = ${id} FOR UPDATE`;
      const record = recordList.length > 0 ? recordList[0] : null;
      return record ? this.mapToDomain(record) : null;
    }

    // 트랜잭션 컨텍스트가 없으면 일반 조회
    const record = await this.prismaClient.coupons.findUnique({
      where: { id },
    });
    return record ? this.mapToDomain(record) : null;
  }

  // ANCHOR coupon.findManyByIds
  async findManyByIds(ids: number[]): Promise<Coupon[]> {
    if (ids.length === 0) {
      return [];
    }
    const records = await this.prismaClient.coupons.findMany({
      where: { id: { in: ids } },
    });
    return records.map((record) => this.mapToDomain(record));
  }

  // ANCHOR coupon.findAll
  async findAll(): Promise<Coupon[]> {
    const records = await this.prismaClient.coupons.findMany();
    return records.map((record) => this.mapToDomain(record));
  }

  // ANCHOR coupon.create
  async create(coupon: Coupon): Promise<Coupon> {
    const created = await this.prismaClient.coupons.create({
      data: {
        name: coupon.name,
        discount_rate: coupon.discountRate,
        total_quantity: coupon.totalQuantity,
        issued_quantity: coupon.issuedQuantity,
        expired_at: coupon.expiredAt,
        created_at: coupon.createdAt,
        updated_at: coupon.updatedAt,
      },
    });
    return this.mapToDomain(created);
  }

  // ANCHOR coupon.update
  async update(coupon: Coupon): Promise<Coupon> {
    const updated = await this.prismaClient.coupons.update({
      where: { id: coupon.id },
      data: {
        name: coupon.name,
        discount_rate: coupon.discountRate,
        total_quantity: coupon.totalQuantity,
        issued_quantity: coupon.issuedQuantity,
        expired_at: coupon.expiredAt,
        updated_at: coupon.updatedAt,
      },
    });
    return this.mapToDomain(updated);
  }

  /**
   * Helper 도메인 맵퍼
   */
  private mapToDomain(record: any): Coupon {
    const maybeDecimal = record.discount_rate as { toNumber?: () => number };
    const discountRate =
      typeof maybeDecimal?.toNumber === 'function'
        ? maybeDecimal.toNumber()
        : Number(record.discount_rate);

    return new Coupon(
      record.id,
      record.name,
      discountRate,
      record.total_quantity,
      record.issued_quantity,
      record.expired_at,
      record.created_at,
      record.updated_at,
    );
  }
}

/**
 * UserCoupon Repository Implementation (Prisma)
 */
@Injectable()
export class UserCouponRepository implements IUserCouponRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get prismaClient(): Prisma.TransactionClient | PrismaService {
    return this.prisma.getClient();
  }

  // ANCHOR userCoupon.findById
  async findById(id: number): Promise<UserCoupon | null> {
    const record = await this.prismaClient.user_coupons.findUnique({
      where: { id: BigInt(id) },
    });
    return record ? this.mapToDomain(record) : null;
  }

  // ANCHOR userCoupon.findByUserId
  async findByUserId(userId: number): Promise<UserCoupon[]> {
    const records = await this.prismaClient.user_coupons.findMany({
      where: { user_id: userId },
    });
    return records.map((record) => this.mapToDomain(record));
  }

  // ANCHOR userCoupon.findByUserCoupon
  async findByUserCoupon(
    userId: number,
    couponId: number,
  ): Promise<UserCoupon | null> {
    const record = await this.prismaClient.user_coupons.findUnique({
      where: {
        user_id_coupon_id: {
          user_id: userId,
          coupon_id: couponId,
        },
      },
    });
    return record ? this.mapToDomain(record) : null;
  }

  // ANCHOR userCoupon.create
  async create(userCoupon: UserCoupon): Promise<UserCoupon> {
    const created = await this.prismaClient.user_coupons.create({
      data: {
        user_id: userCoupon.userId,
        coupon_id: userCoupon.couponId,
        order_id: userCoupon.orderId ? BigInt(userCoupon.orderId) : null,
        created_at: userCoupon.createdAt,
        used_at: userCoupon.usedAt,
        expired_at: userCoupon.expiredAt,
        updated_at: userCoupon.updatedAt,
      },
    });
    return this.mapToDomain(created);
  }

  // ANCHOR userCoupon.update
  async update(userCoupon: UserCoupon): Promise<UserCoupon> {
    const updated = await this.prismaClient.user_coupons.update({
      where: { id: BigInt(userCoupon.id) },
      data: {
        order_id: userCoupon.orderId ? BigInt(userCoupon.orderId) : null,
        used_at: userCoupon.usedAt,
        updated_at: userCoupon.updatedAt,
      },
    });
    return this.mapToDomain(updated);
  }

  /**
   * Helper 도메인 맵퍼
   */
  private mapToDomain(record: any): UserCoupon {
    return new UserCoupon(
      Number(record.id),
      record.user_id,
      record.coupon_id,
      record.order_id ? Number(record.order_id) : null,
      record.created_at,
      record.used_at,
      record.expired_at,
      record.updated_at,
    );
  }
}
