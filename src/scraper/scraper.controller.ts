import { Controller, Post, Get, Sse, UseGuards } from '@nestjs/common';
import { ScraperService } from './scraper.service';
import { Observable } from 'rxjs';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';

export interface MessageEvent {
  data: string | object;
  id?: string;
  type?: string;
  retry?: number;
}

@Controller('scraper')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.SUPPORT)
export class ScraperController {
  constructor(private readonly scraperService: ScraperService) {}

  @Post('start')
  start() {
    return this.scraperService.start();
  }

  @Post('pause')
  pause() {
    return this.scraperService.pause();
  }

  @Post('resume')
  resume() {
    return this.scraperService.resume();
  }

  @Post('stop')
  stop() {
    return this.scraperService.stop();
  }

  @Get('status')
  getStatus() {
    return this.scraperService.getStatus();
  }

  @Sse('stream')
  stream(): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      const handleLog = (data: any) => {
        subscriber.next({ data: { type: 'log', ...data } } as MessageEvent);
      };
      const handleStatus = (data: any) => {
        subscriber.next({ data: { type: 'status', ...data } } as MessageEvent);
      };

      this.scraperService.events.on('log', handleLog);
      this.scraperService.events.on('status', handleStatus);

      // Send initial status immediately upon connection
      subscriber.next({ data: { type: 'status', ...this.scraperService.getStatus() } } as MessageEvent);

      return () => {
        this.scraperService.events.off('log', handleLog);
        this.scraperService.events.off('status', handleStatus);
      };
    });
  }
}
