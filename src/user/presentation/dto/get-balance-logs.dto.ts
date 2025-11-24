import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsString, IsNumber, IsDateString } from 'class-validator';

/**
 * 잔액 변경 이력 조회 요청 DTO
 */
export class GetBalanceLogsQueryDto {
  @ApiPropertyOptional({ description: '조회 시작 시각 (ISO8601)' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: '조회 종료 시각 (ISO8601)' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({
    description: '변경 유형 코드 (CHARGE, PAYMENT, REFUND, ADJUST)',
  })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ description: '관련 엔티티 PK (예: orderId)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  refId?: number;

  @ApiPropertyOptional({ description: '페이지 번호', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number;

  @ApiPropertyOptional({ description: '페이지 크기', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  size?: number;
}

/**
 * 잔액 변경 이력 항목 DTO
 */
export class BalanceLogDto {
  @ApiProperty({ description: '로그 ID' })
  id: number;

  @ApiProperty({ description: '사용자 ID' })
  userId: number;

  @ApiProperty({ description: '변경 금액' })
  amount: number;

  @ApiProperty({ description: '변경 전 금액' })
  beforeAmount: number;

  @ApiProperty({ description: '변경 후 금액' })
  afterAmount: number;

  @ApiProperty({ description: '변경 유형 코드' })
  code: string;

  @ApiProperty({ description: '메모', nullable: true })
  note: string | null;

  @ApiProperty({ description: '관련 엔티티 PK', nullable: true })
  refId: number | null;

  @ApiProperty({ description: '생성 시각' })
  createdAt: Date;
}

/**
 * 잔액 변경 이력 조회 응답 DTO
 */
export class GetBalanceLogsResponseDto {
  @ApiProperty({ description: '잔액 변경 이력 목록', type: [BalanceLogDto] })
  logs: BalanceLogDto[];

  @ApiProperty({ description: '현재 페이지' })
  page: number;

  @ApiProperty({ description: '페이지 크기' })
  size: number;

  @ApiProperty({ description: '전체 개수' })
  total: number;
}
