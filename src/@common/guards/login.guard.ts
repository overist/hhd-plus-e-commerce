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

    if (!session || !session.userId) {
      throw new UnauthorizedException('로그인이 필요합니다');
    }

    return true;
  }
}
