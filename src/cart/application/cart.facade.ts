// CART FACADE

import { CartDomainService } from '@/cart/domain/services/cart.service';
import { Product } from '@/product/domain/entities/product.entity';
import { ProductDomainService } from '@/product/domain/services/product.service';
import { ProductOption } from '@/product/domain/entities/product-option.entity';
import { Injectable } from '@nestjs/common';

export interface CartItemView {
  cartItemId: number;
  productId: number;
  productName: string;
  productOptionId: number;
  productOptionColor: string | null;
  productOptionSize: string | null;
  price: number;
  quantity: number;
}

@Injectable()
export class CartFacade {
  constructor(
    private readonly cartService: CartDomainService,
    private readonly productService: ProductDomainService,
  ) {}

  /**
   * ANCHOR 장바구니-상품옵션 조회 뷰 반환
   *
   * ✅ [성능 최적화 완료] N+1 쿼리 문제 해결
   * 개선 사항:
   * - IN 절을 활용한 일괄 조회로 변경
   * - 쿼리 횟수: O(n) → O(1)로 개선
   * - 장바구니 100개 기준: 201번 쿼리 → 3번 쿼리 (98.5% 감소)
   */
  async getCartView(userId: number): Promise<CartItemView[]> {
    // 카트 조회
    const cartItems = await this.cartService.getCart(userId);

    if (cartItems.length === 0) {
      return [];
    }

    const optionIds = cartItems.map((item) => item.productOptionId);

    // ✅ N번 쿼리 → 1번 쿼리로 개선 (IN 절 활용)
    const productOptions =
      await this.productService.getProductOptionsByIds(optionIds);

    const productIds = [
      ...new Set(productOptions.map((option) => option.productId)),
    ];

    // ✅ M번 쿼리 → 1번 쿼리로 개선 (IN 절 활용)
    const products = await this.productService.getProductsByIds(productIds);

    const productMap = new Map<number, Product>();
    products.forEach((product) => productMap.set(product.id, product));

    const productOptionMap = new Map<number, ProductOption>();
    productOptions.forEach((option) => productOptionMap.set(option.id, option));

    return cartItems.map((item) => {
      const option = productOptionMap.get(item.productOptionId)!;
      const product = productMap.get(option.productId)!;

      return {
        cartItemId: item.id,
        productId: product.id,
        productName: product.name,
        productOptionId: option.id,
        productOptionColor: option.color,
        productOptionSize: option.size,
        price: product.price,
        quantity: item.quantity,
      };
    });
  }
}
