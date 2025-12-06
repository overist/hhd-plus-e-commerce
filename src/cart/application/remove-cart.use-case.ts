import { Injectable } from '@nestjs/common';
import { CartDomainService } from '@/cart/domain/services/cart.service';
import { RemoveCartCommand, RemoveCartResult } from './dto/remove-cart.dto';

@Injectable()
export class RemoveCartUseCase {
  constructor(private readonly cartService: CartDomainService) {}

  /**
   * 장바구니 항목 삭제 또는 수량 감소
   */
  async removeFromCart(cmd: RemoveCartCommand): Promise<RemoveCartResult> {
    await this.cartService.decreaseQuantityOrRemove(
      cmd.userId,
      cmd.productOptionId,
    );

    return {};
  }
}
