import { Product } from '@/product/domain/entities/product.entity';

/**
 * 애플리케이션 레이어 DTO: GetProducts 요청
 */
export class GetProductsQuery {}

/**
 * 애플리케이션 레이어 DTO: GetProducts 응답
 */
export class GetProductsResult {
  productId: number;
  name: string;
  price: number;
  category: string;
  isAvailable: boolean;

  static fromDomain(product: Product): GetProductsResult {
    const dto = new GetProductsResult();
    dto.productId = product.id;
    dto.name = product.name;
    dto.price = product.price;
    dto.category = product.category;
    dto.isAvailable = product.isAvailable;
    return dto;
  }
}
