import { Injectable } from '@nestjs/common';
import { CartDomainService } from '@/cart/domain/services/cart.service';
import { ProductDomainService } from '@/product/domain/services/product.service';
import { ValidationException, ErrorCode } from '@common/exception';
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
    // get existing cart items to find current quantity for the product option
    const cartItems = await this.cartService.getCart(cmd.userId);
    const existingItem = cartItems.find(
      (i) => i.productOptionId === cmd.productOptionId,
    );

    const currentQuantity = existingItem ? existingItem.quantity : 0;
    const newRequestedQuantity = currentQuantity + cmd.quantity;

    // check option exists and available stock
    const option = await this.productService.getProductOption(
      cmd.productOptionId,
    );

    if (option.availableStock < newRequestedQuantity) {
      throw new ValidationException(ErrorCode.INSUFFICIENT_STOCK);
    }

    // delegate adding/incrementing quantity to domain service
    await this.cartService.addCart(
      cmd.userId,
      cmd.productOptionId,
      cmd.quantity,
    );
    return new AddCartResult();
  }
}
