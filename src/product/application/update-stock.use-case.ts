import { Injectable } from '@nestjs/common';
import { ProductDomainService } from '@/product/domain/services/product.service';
import { UpdateStockCommand, UpdateStockResult } from './dto/update-stock.dto';

@Injectable()
export class UpdateStockUseCase {
  constructor(private readonly productService: ProductDomainService) {}

  /**
   * ANCHOR 관리자 상품 재고 수정
   */
  async execute(cmd: UpdateStockCommand): Promise<UpdateStockResult> {
    await this.productService.updateProductOptionStock(
      cmd.productOptionId,
      cmd.operation,
      cmd.quantity,
    );

    return {};
  }
}
