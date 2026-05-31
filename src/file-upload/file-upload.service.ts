import {
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class FileUploadService {
  private readonly logger = new Logger(FileUploadService.name);
  private s3: AWS.S3 | null = null;
  private bucket: string = '';
  private configured = false;

  constructor(private configService: ConfigService) {
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');
    const region = this.configService.get<string>('AWS_REGION', 'ap-south-1');
    const bucket = this.configService.get<string>('AWS_S3_BUCKET', 'medilink-uploads');

    if (!accessKeyId || !secretAccessKey || !bucket) {
      const isProd = this.configService.get<string>('NODE_ENV') === 'production';
      if (isProd) {
        // Fail loudly: file features are broken without S3.
        // We don't throw here so the rest of the app can still boot, but the
        // service will reject every upload with a clear message.
        this.logger.error(
          'AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_S3_BUCKET missing — ' +
          'file upload + signed-URL features are DISABLED. Set these in the production environment.',
        );
      } else {
        this.logger.warn(
          'AWS S3 credentials not configured — file upload is disabled in this environment. ' +
          'Add AWS_* env vars to .env to enable.',
        );
      }
      return;
    }

    this.s3 = new AWS.S3({ accessKeyId, secretAccessKey, region });
    this.bucket = bucket;
    this.configured = true;
    this.logger.log(`S3 configured: bucket=${bucket} region=${region}`);
  }

  isConfigured(): boolean {
    return this.configured;
  }

  private assertConfigured(): void {
    if (!this.configured || !this.s3) {
      throw new ServiceUnavailableException(
        'File storage is not configured on this server. Contact your administrator.',
      );
    }
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: string = 'uploads',
  ): Promise<{ url: string; key: string }> {
    this.assertConfigured();
    const ext = file.originalname.split('.').pop();
    const key = `${folder}/${uuidv4()}.${ext}`;

    try {
      const result = await this.s3!
        .upload({
          Bucket: this.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
          ACL: 'private',
          ServerSideEncryption: 'AES256',
        })
        .promise();

      return { url: result.Location, key };
    } catch (err: any) {
      this.logger.error(`Upload failed for key=${key}: ${err.message}`);
      throw new InternalServerErrorException(`File upload failed: ${err.message}`);
    }
  }

  async deleteFile(key: string): Promise<void> {
    if (!this.configured || !this.s3) return; // silent in dev
    try {
      await this.s3
        .deleteObject({ Bucket: this.bucket, Key: key })
        .promise();
    } catch (err: any) {
      this.logger.warn(`Delete failed for key=${key}: ${err.message}`);
      // Don't throw — deletion failure is non-critical for callers
    }
  }

  async getSignedUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    this.assertConfigured();
    return this.s3!.getSignedUrlPromise('getObject', {
      Bucket: this.bucket,
      Key: key,
      Expires: expiresInSeconds,
    });
  }
}
