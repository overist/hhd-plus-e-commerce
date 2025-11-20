import { ApiProperty } from '@nestjs/swagger';

export class SignupResponseDto {
  @ApiProperty({ example: 1, description: '생성된 사용자 ID' })
  userId: number;

  @ApiProperty({ example: 0, description: '초기 잔액' })
  balance: number;
}
