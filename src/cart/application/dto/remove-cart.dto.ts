/**
 * 애플리케이션 레이어 DTO: RemoveCart 요청
 */
export class RemoveCartCommand {
  userId: number;
  productOptionId: number;
  quantity: number;
}

/**
 * 애플리케이션 레이어 DTO: RemoveCart 응답
 */
export class RemoveCartResult {}
