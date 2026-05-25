import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { PushToken } from './entities/push-token.entity';
import { UserNotification } from './entities/user-notification.entity';
import { RegisterTokenDto } from './dto/register-token.dto';
import { SendNotificationDto } from './dto/send-notification.dto';

interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  badge?: number;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

  constructor(
    @InjectRepository(PushToken)
    private readonly pushTokenRepo: Repository<PushToken>,
    @InjectRepository(UserNotification)
    private readonly notifRepo: Repository<UserNotification>,
  ) {}

  async registerToken(userId: string, dto: RegisterTokenDto): Promise<PushToken> {
    this.logger.log(`[registerToken] userId=${userId} token=${dto.token?.slice(0, 30)}... platform=${dto.platform}`);
    let token = await this.pushTokenRepo.findOne({ where: { token: dto.token } });

    if (token) {
      token.userId = userId;
      token.isActive = true;
      if (dto.platform) token.platform = dto.platform;
    } else {
      token = this.pushTokenRepo.create({
        userId,
        token: dto.token,
        platform: dto.platform,
        isActive: true,
      });
    }

    const saved = await this.pushTokenRepo.save(token);
    this.logger.log(`[registerToken] saved tokenId=${saved.id}`);
    return saved;
  }

  async deregisterToken(userId: string, token: string): Promise<void> {
    await this.pushTokenRepo.update(
      { userId, token },
      { isActive: false },
    );
  }

  async sendToUsers(dto: SendNotificationDto): Promise<{ sent: number; failed: number }> {
    this.logger.log(`[sendToUsers] userIds=${JSON.stringify(dto.userIds)} title="${dto.title}"`);

    // Persist in-app notification for each recipient
    const records = dto.userIds.map((userId) =>
      this.notifRepo.create({ userId, title: dto.title, body: dto.body, data: dto.data ?? null }),
    );
    await this.notifRepo.save(records);
    this.logger.log(`[sendToUsers] persisted ${records.length} in-app notification(s)`);

    const tokens = await this.pushTokenRepo.find({
      where: { userId: In(dto.userIds), isActive: true },
    });
    this.logger.log(`[sendToUsers] found ${tokens.length} active push token(s)`);

    if (tokens.length === 0) {
      return { sent: 0, failed: 0 };
    }

    const chunks = this.chunkArray(tokens, 100);
    let sent = 0;
    let failed = 0;

    for (const chunk of chunks) {
      const messages: ExpoMessage[] = chunk.map(t => ({
        to: t.token,
        title: dto.title,
        body: dto.body,
        data: dto.data,
        sound: 'default',
      }));

      try {
        const response = await fetch(this.EXPO_PUSH_URL, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Accept-Encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(messages),
        });

        const result = await response.json() as { data: { status: string; message?: string }[] };
        this.logger.log(`[sendToUsers] Expo response: ${JSON.stringify(result?.data)}`);

        if (result?.data) {
          result.data.forEach((r) => {
            if (r.status === 'ok') sent++;
            else {
              failed++;
              this.logger.warn(`[sendToUsers] push failed: ${r.message}`);
            }
          });
        } else {
          failed += chunk.length;
        }
      } catch (err) {
        this.logger.error(`[sendToUsers] fetch error: ${err.message}`);
        failed += chunk.length;
      }
    }

    this.logger.log(`[sendToUsers] done sent=${sent} failed=${failed}`);
    return { sent, failed };
  }

  async getUserNotifications(
    userId: string,
    page = 1,
    limit = 30,
  ): Promise<{ data: UserNotification[]; total: number; unreadCount: number }> {
    const skip = (page - 1) * limit;
    const [data, total] = await this.notifRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });
    const unreadCount = await this.notifRepo.count({ where: { userId, isRead: false } });
    return { data, total, unreadCount };
  }

  async markAsRead(userId: string, id: string): Promise<void> {
    await this.notifRepo.update({ id, userId }, { isRead: true });
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notifRepo.update({ userId, isRead: false }, { isRead: true });
  }

  async getTokensForUser(userId: string): Promise<PushToken[]> {
    return this.pushTokenRepo.find({ where: { userId, isActive: true } });
  }

  private chunkArray<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }
}
