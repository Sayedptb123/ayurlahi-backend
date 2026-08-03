import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';
import { Patient } from './entities/patient.entity';
import { Branch } from '../branches/entities/branch.entity';
import { BranchVisibilityModule } from '../branch-visibility/branch-visibility.module';

@Module({
  imports: [TypeOrmModule.forFeature([Patient, Branch]), BranchVisibilityModule],
  controllers: [PatientsController],
  providers: [PatientsService],
  exports: [PatientsService],
})
export class PatientsModule {}
