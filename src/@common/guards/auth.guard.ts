import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

/**
 * 세션 기반 인증 Guard
 * 세션에 userId가 있는지 확인
 */
@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const session = request.session;

    const userIdParam = request.params?.userId || request.body?.userId;

    if (!session || !session.userId) {
      throw new UnauthorizedException('로그인이 필요합니다');
    }

    if (userIdParam !== undefined && session.userId !== Number(userIdParam)) {
      throw new UnauthorizedException('권한이 없습니다');
    }

    return true;
  }
}
