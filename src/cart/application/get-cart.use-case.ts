import { CartDomainService } from '@/cart/domain/services/cart.service';
import { ProductDomainService } from '@/product/domain/services/product.service';
import { Injectable } from '@nestjs/common';
import { GetCartQuery, GetCartResult } from './dto/get-cart.dto';

@Injectable()
export class GetCartUseCase {
  constructor(
    private readonly cartService: CartDomainService,
    private readonly productService: ProductDomainService,
  ) {}

  /**
   * 장바구니-상품옵션 조회 뷰 반환
   */
  async execute(query: GetCartQuery): Promise<GetCartResult[]> {
    const cartItems = await this.cartService.getCartItems(query.userId);
    if (cartItems.length === 0) return [];

    const optionIds = cartItems.map((item) => item.productOptionId);
    const options = await this.productService.getProductOptionsByIds(optionIds);
    const optionMap = new Map(options.map((o) => [o.id, o]));

    const productIds = [...new Set(options.map((o) => o.productId))];
    const products = await this.productService.getProductsByIds(productIds);
    const productMap = new Map(products.map((p) => [p.id, p]));

    return cartItems.map((item) => {
      const option = optionMap.get(item.productOptionId)!;
      const product = productMap.get(option.productId)!;

      return GetCartResult.fromDomain(item, option, product);
    });
  }
}
