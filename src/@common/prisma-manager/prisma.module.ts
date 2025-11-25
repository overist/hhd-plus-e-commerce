import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * 전역 PrismaModule
 * 앱 전체에서 동일한 PrismaService 인스턴스를 사용하도록 보장합니다.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class GlobalPrismaModule {}
