// CART FACADE

import { Product } from '@domain/product/product.entity';
import { ProductDomainService } from '@domain/product/product.service';
import { ProductOption } from '@domain/product/product-option.entity';
import { Injectable } from '@nestjs/common';

export interface ProductDetailView {
  product: Product;
  options: ProductOption[];
}

@Injectable()
export class ProductFacade {
  constructor(private readonly productService: ProductDomainService) {}

  /**
   * TODO 장바구니-상품옵션 조회 뷰 반환
   */
  async getProductView() {
    // 카트 조회
    const productItems = await this.productService.getProductsOnSale();
    return;
  }

  /**
   * ANCHOR 상품 상세 조회 뷰 반환
   */
  async getProductDetailView(productId: number): Promise<ProductDetailView> {
    const product = await this.productService.getProduct(productId);
    const options = await this.productService.getProductOptions(productId);

    return { product, options };
  }

  /**
   * ANCHOR 관리자 상품 재고 업데이트
   */
  async updateStock(
    productOptionId: number,
    quantity: number,
    operation: 'increase' | 'decrease',
  ): Promise<void> {
    await this.productService.updateProductOptionStock(
      productOptionId,
      operation,
      quantity,
    );
  }
}
