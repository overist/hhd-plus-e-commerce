import { CartItem } from '@/cart/domain/entities/cart-item.entity';
import { Product } from '@/product/domain/entities/product.entity';
import { ProductOption } from '@/product/domain/entities/product-option.entity';

/**
 * 애플리케이션 레이어 DTO: GetCart 요청
 */
export class GetCartQuery {
  userId: number;
}

/**
 * 애플리케이션 레이어 DTO: result -> 뷰
 */
export class GetCartResult {
  cartItemId: number;
  productId: number;
  productName: string;
  productOptionId: number;
  productOptionColor: string | null;
  productOptionSize: string | null;
  price: number;
  quantity: number;

  static fromDomain(
    cartItem: CartItem,
    productOption: ProductOption,
    product: Product,
  ): GetCartResult {
    const dto = new GetCartResult();
    dto.cartItemId = cartItem.id;
    dto.productId = product.id;
    dto.productName = product.name;
    dto.productOptionId = productOption.id;
    dto.productOptionColor = productOption.color;
    dto.productOptionSize = productOption.size;
    dto.price = product.price;
    dto.quantity = cartItem.quantity;
    return dto;
  }
}
