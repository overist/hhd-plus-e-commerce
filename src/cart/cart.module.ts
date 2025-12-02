import { Module } from '@nestjs/common';
import { GetCartUseCase } from '@/cart/application/get-cart.use-case';
import { AddCartUseCase } from '@/cart/application/add-cart.use-case';
import { RemoveCartUseCase } from '@/cart/application/remove-cart.use-case';
import { CartDomainService } from '@/cart/domain/services/cart.service';
import { ProductModule } from '../product/product.module';
import { ICartRepository } from '@/cart/domain/interfaces/cart.repository.interface';
import { CartRepository } from '@/cart/infrastructure/cart.repository';
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
    CartRepository,
    {
      provide: ICartRepository,
      useClass: CartRepository,
    },

    // Domain Service
    CartDomainService,

    // UseCase
    GetCartUseCase,
    AddCartUseCase,
    RemoveCartUseCase,
  ],
  exports: [CartDomainService, ICartRepository],
})
export class CartModule {}
