import {
  Controller,
  Post,
  Get,
  Body,
  Session,
  HttpCode,
  HttpStatus,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '@infrastructure/prisma/prisma.service';
import { SignupResponseDto, LoginRequestDto, LoginResponseDto } from './dto';

/**
 * Auth Controller (테스트용)
 * 간단한 회원가입/로그인 기능 제공
 */
@ApiTags('Auth')
@Controller('api/auth')
export class AuthController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 회원가입 (파라미터 없이 자동 생성)
   * POST /api/auth/signup
   */
  @Post('signup')
  @ApiOperation({
    summary: '회원가입',
    description: '새로운 사용자를 자동으로 생성합니다. (테스트용)',
  })
  @ApiResponse({
    status: 201,
    description: '회원가입 성공',
    type: SignupResponseDto,
  })
  @ApiResponse({ status: 500, description: '서버 오류' })
  async signup(@Session() session: any): Promise<SignupResponseDto> {
    // 사용자 생성 (초기 잔액 0)
    const user = await this.prisma.users.create({
      data: {
        balance: 0,
      },
    });

    // 세션에 userId 저장
    session.userId = user.id;

    return {
      userId: user.id,
      balance: Number(user.balance),
    };
  }

  /**
   * 로그인 (userId로 로그인)
   * POST /api/auth/login
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '로그인',
    description: 'userId를 사용하여 로그인합니다. (테스트용)',
  })
  @ApiResponse({
    status: 200,
    description: '로그인 성공',
    type: LoginResponseDto,
  })
  @ApiResponse({ status: 404, description: '사용자를 찾을 수 없음' })
  @ApiResponse({ status: 500, description: '서버 오류' })
  async login(
    @Body() dto: LoginRequestDto,
    @Session() session: any,
  ): Promise<LoginResponseDto> {
    // 사용자 존재 확인
    const user = await this.prisma.users.findUnique({
      where: { id: dto.userId },
    });

    if (!user) {
      throw new BadRequestException('사용자를 찾을 수 없습니다');
    }

    // 세션에 userId 저장
    session.userId = dto.userId;

    return {
      success: true,
      userId: dto.userId,
    };
  }

  /**
   * 로그아웃
   * POST /api/auth/logout
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '로그아웃',
    description: '세션을 종료합니다.',
  })
  @ApiResponse({ status: 200, description: '로그아웃 성공' })
  async logout(@Session() session: any): Promise<{ success: boolean }> {
    session.userId = null;
    return { success: true };
  }
}
