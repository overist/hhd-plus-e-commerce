import { Module } from '@nestjs/common';
import { GetCartUseCase } from '@/cart/application/get-cart.use-case';
import { AddCartUseCase } from '@/cart/application/add-cart.use-case';
import { RemoveCartUseCase } from '@/cart/application/remove-cart.use-case';
import { CartDomainService } from '@/cart/domain/services/cart.service';
import { ProductModule } from '../product/product.module';
import { ICartRepository } from '@/cart/domain/interfaces/cart.repository.interface';
import { CartPrismaRepository } from '@/cart/infrastructure/cart.prisma.repository';
import { CartController } from '@/cart/presentation/cart.controller';

/**
 * Cart Module
 * 장바구니 관리 모듈
 */
@Module({
  imports: [ProductModule],
  controllers: [CartController],
  providers: [
    // Cart Repository (자신의 도메인만)
    CartPrismaRepository,
    {
      provide: ICartRepository,
      useClass: CartPrismaRepository,
    },

    // Domain Service
    CartDomainService,

    // UseCase
    GetCartUseCase,
    AddCartUseCase,
    // Remove use case
    RemoveCartUseCase,
  ],
  exports: [CartDomainService, ICartRepository],
})
export class CartModule {}
