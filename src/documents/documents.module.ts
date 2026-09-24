import { Module } from '@nestjs/common';
import { BranchVisibilityModule } from '../branch-visibility/branch-visibility.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { Document } from './entities/document.entity';
import { OrganisationUsersModule } from '../organisation-users/organisation-users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document]),
    BranchVisibilityModule,
    OrganisationUsersModule,
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule { }


