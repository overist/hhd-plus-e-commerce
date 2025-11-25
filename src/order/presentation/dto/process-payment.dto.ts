import {
  ProcessPaymentCommand,
  ProcessPaymentResult,
} from '@/order/application/dto/process-payment.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsPositive } from 'class-validator';

/**
 * 결제 처리 요청 DTO
 */
export class ProcessPaymentRequest {
  @ApiProperty({
    description: '사용자 ID',
    example: 1,
  })
  @IsInt()
  @IsPositive()
  userId: number;

  @ApiPropertyOptional({
    description: '사용할 쿠폰 ID (선택)',
    example: 1,
  })
  @IsInt()
  @IsPositive()
  @IsOptional()
  userCouponId?: number;

  static toCommand(
    orderId: number,
    dto: ProcessPaymentRequest,
  ): ProcessPaymentCommand {
    const command = new ProcessPaymentCommand();
    command.orderId = orderId;
    command.userId = dto.userId;
    command.userCouponId = dto.userCouponId;
    return command;
  }
}

/**
 * 결제 처리 응답 DTO
 */
export class ProcessPaymentResponse {
  @ApiProperty({ description: '주문 ID' })
  orderId: number;

  @ApiProperty({ description: '주문 상태' })
  status: string;

  @ApiProperty({ description: '결제 금액' })
  paidAmount: number;

  @ApiProperty({ description: '잔여 잔액' })
  remainingBalance: number;

  @ApiProperty({ description: '결제 완료 시각' })
  paidAt: Date;

  static fromResult(result: ProcessPaymentResult): ProcessPaymentResponse {
    const response = new ProcessPaymentResponse();
    response.orderId = result.orderId;
    response.status = result.status;
    response.paidAmount = result.paidAmount;
    response.remainingBalance = result.remainingBalance;
    response.paidAt = result.paidAt;
    return response;
  }
}
