import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtRefreshGuard extends AuthGuard('jwt-refresh') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;
    console.log('[JwtRefreshGuard] Checking refresh token');
    console.log('[JwtRefreshGuard] Authorization header:', authHeader ? 'Present' : 'Missing');
    
    if (authHeader) {
      // Log first 20 chars to see format without exposing full token
      const preview = authHeader.substring(0, 20);
      console.log('[JwtRefreshGuard] Auth header preview:', preview + '...');
      console.log('[JwtRefreshGuard] Auth header length:', authHeader.length);
      console.log('[JwtRefreshGuard] Starts with "Bearer "?', authHeader.startsWith('Bearer '));
      
      if (!authHeader.startsWith('Bearer ')) {
        console.error('[JwtRefreshGuard] ❌ Token missing "Bearer " prefix!');
        console.error('[JwtRefreshGuard] Full header:', authHeader);
      } else {
        const token = authHeader.substring(7); // Remove "Bearer "
        console.log('[JwtRefreshGuard] Token preview:', token.substring(0, 20) + '...');
        console.log('[JwtRefreshGuard] Token length:', token.length);
        
        // Check if token looks like a JWT (should have 3 parts separated by dots)
        const parts = token.split('.');
        console.log('[JwtRefreshGuard] Token parts count:', parts.length);
        if (parts.length !== 3) {
          console.error('[JwtRefreshGuard] ❌ Token does not have 3 parts (header.payload.signature)');
        }
      }
    }
    
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    console.log('[JwtRefreshGuard] handleRequest called');
    console.log('[JwtRefreshGuard] Error:', err?.message || 'None');
    console.log('[JwtRefreshGuard] Info:', info?.name || 'None', info?.message || '');
    console.log('[JwtRefreshGuard] User:', user ? { id: user.id, email: user.email } : 'None');
    
    if (err || !user) {
      console.error('[JwtRefreshGuard] ❌ Authentication failed');
      if (info) {
        console.error('[JwtRefreshGuard] Info details:', {
          name: info.name,
          message: info.message,
        });
      }
      
      // Provide helpful error message
      if (info?.message === 'No auth token' || info?.message?.includes('jwt malformed')) {
        const request = context.switchToHttp().getRequest();
        const authHeader = request.headers.authorization;
        if (authHeader && authHeader.includes('undefined')) {
          console.error('[JwtRefreshGuard] ⚠️  FRONTEND ISSUE: Token is literally "undefined"');
          console.error('[JwtRefreshGuard] The frontend is sending: Authorization: Bearer undefined');
          console.error('[JwtRefreshGuard] Frontend needs to check if token exists before sending request');
        }
      }
    }
    
    return super.handleRequest(err, user, info, context);
  }
}

