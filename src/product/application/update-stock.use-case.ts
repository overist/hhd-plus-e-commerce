import { Injectable } from '@nestjs/common';
import { ProductDomainService } from '@/product/domain/services/product.service';
import { PrismaService } from '@common/prisma-manager/prisma.service';
import { UpdateStockCommand, UpdateStockResult } from './dto/update-stock.dto';

@Injectable()
export class UpdateStockUseCase {
  constructor(
    private readonly productService: ProductDomainService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * ANCHOR 관리자 상품 재고 수정
   * 트랜잭션으로 조회-수정 원자성 보장
   */
  async updateStock(cmd: UpdateStockCommand): Promise<UpdateStockResult> {
    await this.prisma.runInTransaction(async () => {
      await this.productService.updateProductOptionStock(
        cmd.productOptionId,
        cmd.operation,
        cmd.quantity,
      );
    });

    return {};
  }
}
