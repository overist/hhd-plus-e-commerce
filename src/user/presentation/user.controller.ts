import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';

// DTOs
import { GetBalanceRequest, GetBalanceResponse } from './dto/get-balance.dto';
import {
  GetBalanceLogsRequest,
  GetBalanceLogsResponse,
} from './dto/get-balance-logs.dto';
import {
  ChargeBalanceRequest,
  ChargeBalanceResponse,
} from './dto/charge-balance.dto';

// Use Cases
import { GetBalanceUseCase } from '@/user/application/get-balance.use-case';
import { GetBalanceLogsUseCase } from '@/user/application/get-balance-logs.use-case';
import { ChargeBalanceUseCase } from '@/user/application/charge-balance.use-case';

// Guards
import { AdminGuard } from '@common/guards/admin.guard';
import { AuthGuard } from '@common/guards/auth.guard';

/**
 * User Controller
 * 사용자 잔액 관리 API 엔드포인트
 */
@ApiTags('Users')
@Controller('api/users')
export class UserController {
  constructor(
    private readonly getBalanceUseCase: GetBalanceUseCase,
    private readonly getBalanceLogsUseCase: GetBalanceLogsUseCase,
    private readonly chargeBalanceUseCase: ChargeBalanceUseCase,
  ) {}

  /**
   * ANCHOR 잔액 조회 (US-004)
   */
  @Get(':userId/balance')
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: '잔액 조회',
    description: '사용자의 현재 잔액을 조회합니다.',
  })
  @ApiParam({ name: 'userId', description: '사용자 ID' })
  @ApiResponse({
    status: 200,
    description: '성공',
    type: GetBalanceResponse,
  })
  @ApiResponse({ status: 404, description: '사용자를 찾을 수 없음' })
  async getBalance(
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<GetBalanceResponse> {
    const query = GetBalanceRequest.toQuery(userId);
    return await this.getBalanceUseCase.execute(query);
  }

  /**
   * ANCHOR 잔액 충전 (관리자 기능)
   */
  @Patch(':userId/balance')
  @UseGuards(AdminGuard)
  @ApiOperation({
    summary: '잔액 충전',
    description: '사용자의 잔액을 충전합니다.',
  })
  @ApiParam({ name: 'userId', description: '사용자 ID' })
  @ApiResponse({
    status: 200,
    description: '충전 성공',
    type: ChargeBalanceResponse,
  })
  @ApiResponse({ status: 400, description: '잘못된 요청 (충전 금액 오류)' })
  @ApiResponse({ status: 404, description: '사용자를 찾을 수 없음' })
  async chargeBalance(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: ChargeBalanceRequest,
  ): Promise<ChargeBalanceResponse> {
    const command = ChargeBalanceRequest.toCommand(userId, dto);
    return await this.chargeBalanceUseCase.execute(command);
  }

  /**
   * ANCHOR 잔액 변경 이력 조회 (US-016)
   */
  @Get(':userId/balance/logs')
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: '잔액 변경 이력 조회',
    description: '사용자의 잔액 변경 이력을 조회합니다.',
  })
  @ApiParam({ name: 'userId', description: '사용자 ID' })
  @ApiResponse({
    status: 200,
    description: '성공',
    type: GetBalanceLogsResponse,
  })
  @ApiResponse({ status: 400, description: '잘못된 요청 파라미터' })
  @ApiResponse({ status: 404, description: '사용자를 찾을 수 없음' })
  async getBalanceLogs(
    @Param('userId', ParseIntPipe) userId: number,
    @Query() dto: GetBalanceLogsRequest,
  ): Promise<GetBalanceLogsResponse> {
    const query = GetBalanceLogsRequest.toQuery(userId, dto);
    return await this.getBalanceLogsUseCase.execute(query);
  }
}
