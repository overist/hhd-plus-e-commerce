import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive } from 'class-validator';

export class LoginRequestDto {
  @ApiProperty({ example: 1, description: '사용자 ID' })
  @IsInt()
  @IsPositive()
  userId: number;
}

export class LoginResponseDto {
  @ApiProperty({ example: true, description: '로그인 성공 여부' })
  success: boolean;

  @ApiProperty({ example: 1, description: '로그인된 사용자 ID' })
  userId: number;
}
