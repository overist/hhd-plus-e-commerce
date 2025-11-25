import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { AuthGuard } from '@common/guards/auth.guard';

// DTOs
import {
  IssueCouponRequest,
  IssueCouponResponse,
} from './dto/issue-coupon.dto';
import {
  GetUserCouponsRequest,
  GetUserCouponsResponse,
} from './dto/get-user-coupons.dto';

// Use Cases
import { IssueCouponUseCase } from '@/coupon/application/issue-coupon.use-case';
import { GetUserCouponsUseCase } from '@/coupon/application/get-user-coupons.use-case';

/**
 * Coupon Controller
 * 쿠폰 발급 및 조회 API 엔드포인트
 */
@ApiTags('coupons')
@Controller('api')
export class CouponController {
  constructor(
    private readonly issueCouponUseCase: IssueCouponUseCase,
    private readonly getUserCouponsUseCase: GetUserCouponsUseCase,
  ) {}

  /**
   * ANCHOR 쿠폰 발급 (US-013)
   */
  @Post('coupons/:couponId/issue')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '쿠폰 발급',
    description: '선착순으로 쿠폰을 발급받습니다.',
  })
  @ApiParam({ name: 'couponId', description: '쿠폰 ID' })
  @ApiResponse({
    status: 201,
    description: '쿠폰 발급 완료',
    type: IssueCouponResponse,
  })
  @ApiResponse({ status: 400, description: '쿠폰 품절 또는 이미 발급됨' })
  @ApiResponse({ status: 404, description: '쿠폰을 찾을 수 없음' })
  async issueCoupon(
    @Param('couponId', ParseIntPipe) couponId: number,
    @Body() dto: IssueCouponRequest,
  ): Promise<IssueCouponResponse> {
    const command = IssueCouponRequest.toCommand(couponId, dto);

    return await this.issueCouponUseCase.execute(command);
  }

  /**
   * ANCHOR 보유 쿠폰 조회 (US-014)
   */
  @Get('users/:userId/coupons')
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: '보유 쿠폰 조회',
    description: '사용자가 보유한 쿠폰 목록을 조회합니다.',
  })
  @ApiParam({ name: 'userId', description: '사용자 ID' })
  @ApiResponse({
    status: 200,
    description: '쿠폰 목록 조회 성공',
    type: GetUserCouponsResponse,
  })
  @ApiResponse({ status: 404, description: '사용자를 찾을 수 없음' })
  async getUserCoupons(
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<GetUserCouponsResponse> {
    const query = GetUserCouponsRequest.toQuery(userId);
    const result = await this.getUserCouponsUseCase.execute(query);
    return { data: result } as GetUserCouponsResponse;
  }
}
