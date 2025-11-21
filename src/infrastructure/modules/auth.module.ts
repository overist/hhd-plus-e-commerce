import { Module } from '@nestjs/common';
import { AuthController } from '@presentation/auth/auth.controller';

@Module({
  controllers: [AuthController],
  providers: [],
})
export class AuthModule {}
