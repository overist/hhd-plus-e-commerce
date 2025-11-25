/**
 * Order Domain Types
 * 주문 도메인에서 공통으로 사용되는 타입 정의
 */

/**
 * 주문 아이템 생성 데이터
 * OrderService, ProductService에서 공통 사용
 */
export interface OrderItemData {
  productOptionId: number;
  productName: string;
  price: number;
  quantity: number;
}
