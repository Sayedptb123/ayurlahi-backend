import { Module } from '@nestjs/common';
import { BranchVisibilityModule } from '../branch-visibility/branch-visibility.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VitalsController } from './vitals.controller';
import { VitalsService } from './vitals.service';
import { Vital } from './entities/vital.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Vital]),
    BranchVisibilityModule],
  controllers: [VitalsController],
  providers: [VitalsService],
  exports: [VitalsService],
})
export class VitalsModule {}
