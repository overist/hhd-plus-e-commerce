import { Module } from '@nestjs/common';
import { CartFacade } from '@application/facades/cart.facade';
import { CartDomainService } from '@domain/cart/cart.service';
import { ProductDomainService } from '@domain/product/product.service';
import { ProductModule } from './product.module';
import { ICartRepository } from '@domain/interfaces/cart.repository.interface';
import { CartRepository } from '@infrastructure/repositories/prisma/cart.repository';
import { CartController } from '@presentation/cart/cart.controller';

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

    // Facade
    CartFacade,
  ],
  exports: [CartDomainService, ICartRepository],
})
export class CartModule {}
