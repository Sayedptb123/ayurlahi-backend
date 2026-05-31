import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NewbornAssessmentsController } from './newborn-assessments.controller';
import { NewbornAssessmentsService } from './newborn-assessments.service';
import { NewbornAssessment } from './entities/newborn-assessment.entity';
import { ClinicCapabilities } from '../clinic-capabilities/entities/clinic-capabilities.entity';

@Module({
  imports: [TypeOrmModule.forFeature([NewbornAssessment, ClinicCapabilities])],
  controllers: [NewbornAssessmentsController],
  providers: [NewbornAssessmentsService],
  exports: [NewbornAssessmentsService],
})
export class NewbornAssessmentsModule {}
