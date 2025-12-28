import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers?.authorization;

    console.log('[JWT Guard] Checking authentication:', {
      url: request.url,
      method: request.method,
      hasAuthHeader: !!authHeader,
      authHeaderPreview: authHeader
        ? authHeader.substring(0, 30) + '...'
        : 'missing',
    });

    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();

    if (err || !user) {
      console.error('[JWT Guard] Authentication failed:', {
        url: request.url,
        method: request.method,
        error: err?.message,
        info: info?.message || info,
        hasUser: !!user,
        authHeader: request.headers?.authorization
          ? request.headers.authorization.substring(0, 30) + '...'
          : 'missing',
      });
      throw err || new UnauthorizedException('Unauthorized');
    }

    console.log('[JWT Guard] Authentication successful:', {
      url: request.url,
      userId: user.userId,
      email: user.email,
      role: user.role,
    });

    return user;
  }
}
