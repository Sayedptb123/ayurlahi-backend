import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { Document } from './entities/document.entity';
import { OrganisationUsersModule } from '../organisation-users/organisation-users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document]),
    OrganisationUsersModule,
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule { }


