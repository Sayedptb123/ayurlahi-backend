import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { GetDocumentsDto } from './dto/get-documents.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrganisationGuard } from '../auth/guards/organisation.guard';

@Controller('organisations/:organisationId/documents')
@UseGuards(JwtAuthGuard, OrganisationGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  create(
    @Param('organisationId') organisationId: string,
    @Body() createDto: CreateDocumentDto,
    @Request() req,
  ) {
    return this.documentsService.create(
      req.user,
      organisationId,
      createDto,
      req.user?.userId,
    );
  }

  @Get()
  findAll(
    @Param('organisationId') organisationId: string,
    @Query() query: GetDocumentsDto,
    @Request() req,
  ) {
    return this.documentsService.findAll(req.user, organisationId, query);
  }

  @Get('related/:relatedType/:relatedId')
  getByRelated(
    @Param('organisationId') organisationId: string,
    @Param('relatedType') relatedType: string,
    @Param('relatedId') relatedId: string,
    @Request() req,
  ) {
    return this.documentsService.getByRelated(
      req.user,
      organisationId,
      relatedType,
      relatedId,
    );
  }

  @Get(':id')
  findOne(
    @Param('organisationId') organisationId: string,
    @Param('id') id: string,
    @Request() req,
  ) {
    return this.documentsService.findOne(req.user, id, organisationId);
  }

  @Patch(':id')
  update(
    @Param('organisationId') organisationId: string,
    @Param('id') id: string,
    @Body() updateDto: UpdateDocumentDto,
    @Request() req,
  ) {
    return this.documentsService.update(
      req.user,
      id,
      organisationId,
      updateDto,
      req.user?.userId,
    );
  }

  @Post(':id/verify')
  verify(
    @Param('organisationId') organisationId: string,
    @Param('id') id: string,
    @Request() req,
  ) {
    return this.documentsService.verifyDocument(
      req.user,
      id,
      organisationId,
      req.user?.userId,
    );
  }

  @Delete(':id')
  remove(
    @Param('organisationId') organisationId: string,
    @Param('id') id: string,
    @Request() req,
  ) {
    return this.documentsService.remove(req.user, id, organisationId);
  }

  @Post('check-expired')
  checkExpired(@Param('organisationId') organisationId: string) {
    return this.documentsService.checkExpiredDocuments(organisationId);
  }
}


