import { CartDomainService } from '@/cart/domain/services/cart.service';
import { Product } from '@/product/domain/entities/product.entity';
import { ProductDomainService } from '@/product/domain/services/product.service';
import { ProductOption } from '@/product/domain/entities/product-option.entity';
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
    const cartItems = await this.cartService.getCart(query.userId);

    if (cartItems.length === 0) {
      return [];
    }

    const optionIds = cartItems.map((item) => item.productOptionId);
    const productOptions =
      await this.productService.getProductOptionsByIds(optionIds);

    const productIds = [
      ...new Set(productOptions.map((option) => option.productId)),
    ];

    const products = await this.productService.getProductsByIds(productIds);

    const productMap = new Map<number, Product>();
    products.forEach((product) => productMap.set(product.id, product));

    const productOptionMap = new Map<number, ProductOption>();
    productOptions.forEach((option) => productOptionMap.set(option.id, option));

    return cartItems.map((item) => {
      const option = productOptionMap.get(item.productOptionId)!;
      const product = productMap.get(option.productId)!;
      return GetCartResult.fromDomain(item, option, product);
    });
  }
}
