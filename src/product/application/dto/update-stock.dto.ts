/**
 * 애플리케이션 레이어 DTO: UpdateStock 요청
 */
export class UpdateStockCommand {
  productOptionId: number;
  operation: 'increase' | 'decrease';
  quantity: number;
}

/**
 * 애플리케이션 레이어 DTO: UpdateStock 응답
 */
export class UpdateStockResult {}
