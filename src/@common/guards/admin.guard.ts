import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

/**
 * 세션 기반 인증 Guard
 * 세션에 adminId가 있는지 확인
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const session = request.session;

    if (!session || !session.adminId) {
      throw new UnauthorizedException('로그인이 필요합니다');
    }

    // request에 adminId 추가 (컨트롤러에서 사용 가능)
    request.adminId = session.adminId;

    return true;
  }
}
