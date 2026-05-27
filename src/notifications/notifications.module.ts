import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PushToken } from './entities/push-token.entity';
import { UserNotification } from './entities/user-notification.entity';
import { CustomNotificationLog } from './entities/custom-notification-log.entity';
import { Organisation } from '../organisations/entities/organisation.entity';
import { OrganisationUser } from '../organisation-users/entities/organisation-user.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PushToken, UserNotification, CustomNotificationLog, Organisation, OrganisationUser])],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
