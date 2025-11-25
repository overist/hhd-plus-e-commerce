import { Injectable } from '@nestjs/common';
import { CartDomainService } from '@/cart/domain/services/cart.service';
import { ProductDomainService } from '@/product/domain/services/product.service';
import { ApplicationException, ErrorCode } from '@common/exception';
import { AddCartCommand, AddCartResult } from './dto/add-cart.dto';

@Injectable()
export class AddCartUseCase {
  constructor(
    private readonly cartService: CartDomainService,
    private readonly productService: ProductDomainService,
  ) {}

  /**
   * ANCHOR 장바구니에 상품 추가 또는 수량 증가
   */
  async execute(cmd: AddCartCommand): Promise<AddCartResult> {
    const existingItem = await this.cartService.getCartItem(
      cmd.userId,
      cmd.productOptionId,
    );
    const currentQuantity = existingItem?.quantity ?? 0;
    const newRequestedQuantity = currentQuantity + cmd.quantity;

    const option = await this.productService.getProductOption(
      cmd.productOptionId,
    );

    if (option.availableStock < newRequestedQuantity) {
      throw new ApplicationException(ErrorCode.INSUFFICIENT_STOCK);
    }

    await this.cartService.addOrIncreaseQuantity(
      cmd.userId,
      cmd.productOptionId,
      cmd.quantity,
    );

    return {};
  }
}
