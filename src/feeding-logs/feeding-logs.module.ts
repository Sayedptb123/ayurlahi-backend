import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeedingLogsController } from './feeding-logs.controller';
import { FeedingLogsService } from './feeding-logs.service';
import { FeedingLog } from './entities/feeding-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FeedingLog])],
  controllers: [FeedingLogsController],
  providers: [FeedingLogsService],
  exports: [FeedingLogsService],
})
export class FeedingLogsModule {}
