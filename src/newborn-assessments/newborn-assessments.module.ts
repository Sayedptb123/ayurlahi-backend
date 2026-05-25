import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NewbornAssessmentsController } from './newborn-assessments.controller';
import { NewbornAssessmentsService } from './newborn-assessments.service';
import { NewbornAssessment } from './entities/newborn-assessment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([NewbornAssessment])],
  controllers: [NewbornAssessmentsController],
  providers: [NewbornAssessmentsService],
  exports: [NewbornAssessmentsService],
})
export class NewbornAssessmentsModule {}
