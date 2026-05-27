import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { PushToken } from './entities/push-token.entity';
import { UserNotification } from './entities/user-notification.entity';
import { CustomNotificationLog } from './entities/custom-notification-log.entity';
import { Organisation } from '../organisations/entities/organisation.entity';
import { OrganisationUser } from '../organisation-users/entities/organisation-user.entity';
import { RegisterTokenDto } from './dto/register-token.dto';
import { SendNotificationDto } from './dto/send-notification.dto';
import { SendCustomNotificationDto } from './dto/send-custom-notification.dto';

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
    @InjectRepository(CustomNotificationLog)
    private readonly customLogRepo: Repository<CustomNotificationLog>,
    @InjectRepository(Organisation)
    private readonly orgRepo: Repository<Organisation>,
    @InjectRepository(OrganisationUser)
    private readonly orgUserRepo: Repository<OrganisationUser>,
  ) {}

  async registerToken(userId: string, dto: RegisterTokenDto): Promise<PushToken> {
    console.log(`[registerToken] userId=${userId} token=${dto.token} platform=${dto.platform}`);
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
    console.log(`[sendToUsers] START userIds=${JSON.stringify(dto.userIds)} title="${dto.title}"`);
    this.logger.log(`[sendToUsers] userIds=${JSON.stringify(dto.userIds)} title="${dto.title}"`);

    // Persist in-app notification for each recipient
    const records = dto.userIds.map((userId) =>
      this.notifRepo.create({ userId, title: dto.title, body: dto.body, data: dto.data ?? null }),
    );
    try {
      await this.notifRepo.save(records);
      console.log(`[sendToUsers] saved ${records.length} in-app notification(s) OK`);
    } catch (err) {
      console.error(`[sendToUsers] FAILED saving in-app notifications:`, err);
      throw err;
    }
    this.logger.log(`[sendToUsers] persisted ${records.length} in-app notification(s)`);

    const tokens = await this.pushTokenRepo.find({
      where: { userId: In(dto.userIds), isActive: true },
    });
    console.log(`[sendToUsers] push tokens found: ${tokens.map(t => t.token).join(', ') || 'NONE'}`);
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
        console.log(`[sendToUsers] Expo raw response:`, JSON.stringify(result));
        this.logger.log(`[sendToUsers] Expo response: ${JSON.stringify(result?.data)}`);

        if (result?.data) {
          result.data.forEach((r) => {
            if (r.status === 'ok') sent++;
            else {
              failed++;
              console.warn(`[sendToUsers] push FAILED for token: ${r.message}`);
              this.logger.warn(`[sendToUsers] push failed: ${r.message}`);
            }
          });
        } else {
          failed += chunk.length;
        }
      } catch (err) {
        console.error(`[sendToUsers] Expo fetch EXCEPTION:`, err);
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

  async sendCustom(
    sentByUserId: string,
    sentByRole: string,
    dto: SendCustomNotificationDto,
  ): Promise<{ sent: number; failed: number; resolvedUserCount: number }> {
    const allowedRoles = ['SUPER_ADMIN', 'SUPPORT'];
    if (!allowedRoles.includes(sentByRole)) {
      throw new ForbiddenException('Only SUPER_ADMIN and SUPPORT can send custom notifications');
    }

    // 1. Resolve target orgs
    let orgIds: string[] = [];
    if (dto.targetType === 'all') {
      const orgs = await this.orgRepo.find({ select: ['id'] });
      orgIds = orgs.map((o) => o.id);
    } else if (dto.targetType === 'all_clinics') {
      const orgs = await this.orgRepo.find({ where: { type: 'CLINIC' as any }, select: ['id'] });
      orgIds = orgs.map((o) => o.id);
    } else if (dto.targetType === 'all_manufacturers') {
      const orgs = await this.orgRepo.find({ where: { type: 'MANUFACTURER' as any }, select: ['id'] });
      orgIds = orgs.map((o) => o.id);
    } else if (dto.targetType === 'single_org' && dto.organisationId) {
      orgIds = [dto.organisationId];
    }

    // 2. Resolve user IDs from org+role filter
    const resolvedUserIds = new Set<string>();

    if (orgIds.length > 0) {
      const query: Record<string, any> = { organisationId: In(orgIds), isActive: true };
      if (dto.roles && dto.roles.length > 0) {
        query.role = In(dto.roles);
      }
      const orgUsers = await this.orgUserRepo.find({ where: query });
      orgUsers.forEach((ou) => { if (ou.userId) resolvedUserIds.add(ou.userId); });
    }

    // 3. Union with specific user IDs
    if (dto.specificUserIds && dto.specificUserIds.length > 0) {
      dto.specificUserIds.forEach((id) => resolvedUserIds.add(id));
    }

    const userIds = [...resolvedUserIds];
    this.logger.log(`[sendCustom] resolved ${userIds.length} user(s) for targetType=${dto.targetType}`);

    // 4. Send
    let result = { sent: 0, failed: 0 };
    if (userIds.length > 0) {
      result = await this.sendToUsers({ userIds, title: dto.title, body: dto.body, data: { type: 'custom_broadcast' } });
    }

    // 5. Persist log
    await this.customLogRepo.save(
      this.customLogRepo.create({
        title: dto.title,
        body: dto.body,
        targetType: dto.targetType,
        organisationId: dto.organisationId ?? null,
        roles: dto.roles ?? null,
        specificUserIds: dto.specificUserIds ?? null,
        resolvedUserCount: userIds.length,
        sentByUserId,
      }),
    );

    return { ...result, resolvedUserCount: userIds.length };
  }

  async getCustomHistory(
    page = 1,
    limit = 20,
  ): Promise<{ data: CustomNotificationLog[]; total: number }> {
    const [data, total] = await this.customLogRepo.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total };
  }

  async getTokensForUser(userId: string): Promise<PushToken[]> {
    return this.pushTokenRepo.find({ where: { userId, isActive: true } });
  }

  async getAdminUserIds(): Promise<string[]> {
    const adminOrgs = await this.orgRepo.find({
      where: { type: 'AYURLAHI_TEAM' as any },
      select: ['id'],
    });
    if (adminOrgs.length === 0) return [];
    const orgIds = adminOrgs.map((o) => o.id);
    const adminUsers = await this.orgUserRepo.find({
      where: { organisationId: In(orgIds), role: In(['SUPER_ADMIN', 'SUPPORT']), isActive: true },
    });
    return adminUsers.map((u) => u.userId).filter(Boolean);
  }

  private chunkArray<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }
}
