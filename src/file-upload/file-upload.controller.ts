import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  BadRequestException,
  ForbiddenException,
  Query,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FileUploadService } from './file-upload.service';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'image/heic',
];

// Folder names the client is allowed to upload into. We always prefix with the
// org id, so the actual S3 key looks like: <orgId>/<folder>/<uuid>.<ext>
// Adding a new folder = add it here. Prevents abuse like uploading
// "../../some-other-org/" by smuggling characters through the query param.
const ALLOWED_FOLDERS = new Set([
  'uploads',
  'documents',
  'medical-records',
  'lab-reports',
  'prescriptions',
  'invoices',
  'profile-photos',
  'postnatal',
  'misc',
]);

@ApiTags('file-upload')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('upload')
export class FileUploadController {
  constructor(private readonly fileUploadService: FileUploadService) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Request() req,
    @Query('folder') folder?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type not allowed. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }
    const orgId = req.user?.organisationId;
    if (!orgId) {
      throw new ForbiddenException('No organisation context on request');
    }
    const safeFolder = folder && ALLOWED_FOLDERS.has(folder) ? folder : 'uploads';
    // Always namespace uploads by org id so one tenant's signed URL can't be
    // crafted to point at another tenant's data.
    const scopedFolder = `${orgId}/${safeFolder}`;
    return this.fileUploadService.uploadFile(file, scopedFolder);
  }
}
