import { Product } from '@/product/domain/entities/product.entity';
import { ProductOption } from '@/product/domain/entities/product-option.entity';

/**
 * 애플리케이션 레이어 DTO: GetProductDetail 요청
 */
export class GetProductDetailQuery {
  productId: number;
}

/**
 * 상품 옵션 결과 DTO
 */
export class ProductOptionResult {
  productOptionId: number;
  color: string | null;
  size: string | null;
  stock: number;
  availableStock: number;

  static fromDomain(option: ProductOption): ProductOptionResult {
    const dto = new ProductOptionResult();
    dto.productOptionId = option.id;
    dto.color = option.color;
    dto.size = option.size;
    dto.stock = option.stock;
    dto.availableStock = option.availableStock;
    return dto;
  }
}

/**
 * 애플리케이션 레이어 DTO: GetProductDetail 응답
 */
export class GetProductDetailResult {
  productId: number;
  name: string;
  description: string | null;
  price: number;
  category: string;
  isAvailable: boolean;
  options: ProductOptionResult[];

  static fromDomain(
    product: Product,
    options: ProductOption[],
  ): GetProductDetailResult {
    const dto = new GetProductDetailResult();
    dto.productId = product.id;
    dto.name = product.name;
    dto.description = product.description;
    dto.price = product.price;
    dto.category = product.category;
    dto.isAvailable = product.isAvailable;
    dto.options = options.map((opt) => ProductOptionResult.fromDomain(opt));
    return dto;
  }
}
