import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    // Add custom logic here if needed
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    // Handle authentication errors with better messages
    if (err || !user) {
      const request = context.switchToHttp().getRequest();
      const authHeader = request.headers.authorization;

      if (!authHeader) {
        throw new UnauthorizedException('No authorization token provided. Please include Authorization header with Bearer token.');
      }

      if (info?.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Token has expired. Please refresh your token.');
      }

      if (info?.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('Invalid token. Please login again.');
      }

      if (info?.name === 'NotBeforeError') {
        throw new UnauthorizedException('Token not active yet.');
      }

      throw err || new UnauthorizedException('Authentication failed.');
    }
    return user;
  }
}


