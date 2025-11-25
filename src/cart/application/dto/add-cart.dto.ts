/**
 * 애플리케이션 레이어 DTO: AddCart 요청
 */
export class AddCartCommand {
  userId: number;
  productOptionId: number;
  quantity: number;
}

/**
 * 애플리케이션 레이어 DTO: AddCart 응답
 * (기존 구현은 void 응답을 반환하므로 비어있게 둡니다)
 */
export class AddCartResult {}
