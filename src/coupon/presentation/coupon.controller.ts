import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { CouponFacade } from '@/coupon/application/coupon.facade';
import {
  IssueCouponRequestDto,
  IssueCouponResponseDto,
} from './dto/issue-coupon.dto';
import { GetUserCouponsResponseDto } from './dto/get-user-coupons.dto';
import { AuthGuard } from '@common/guards/auth.guard';

/**
 * Coupon Controller
 * 쿠폰 발급 및 조회 API 엔드포인트
 */
@ApiTags('coupons')
@Controller('api')
export class CouponController {
  constructor(private readonly couponFacade: CouponFacade) {}

  /**
   * 쿠폰 발급 (US-013)
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
    type: IssueCouponResponseDto,
  })
  @ApiResponse({ status: 400, description: '쿠폰 품절 또는 이미 발급됨' })
  @ApiResponse({ status: 404, description: '쿠폰을 찾을 수 없음' })
  async issueCoupon(
    @Param('couponId', ParseIntPipe) couponId: number,
    @Body() dto: IssueCouponRequestDto,
  ): Promise<IssueCouponResponseDto> {
    return this.couponFacade.issueCoupon(dto.userId, couponId);
  }

  /**
   * 보유 쿠폰 조회 (US-014)
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
    type: GetUserCouponsResponseDto,
  })
  @ApiResponse({ status: 404, description: '사용자를 찾을 수 없음' })
  async getUserCoupons(
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<GetUserCouponsResponseDto> {
    const coupons = await this.couponFacade.getUserCoupons(userId);
    return { coupons };
  }
}
