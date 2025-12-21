import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as AWS from 'aws-sdk';

@Injectable()
export class S3Service {
  private s3: AWS.S3;
  private bucketName: string;

  constructor(private configService: ConfigService) {
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');
    const bucketName = this.configService.get<string>('AWS_S3_BUCKET');
    
    if (accessKeyId && secretAccessKey && bucketName) {
      this.s3 = new AWS.S3({
        accessKeyId,
        secretAccessKey,
        region: this.configService.get<string>('AWS_REGION', 'ap-south-1'),
      });
      this.bucketName = bucketName;
    } else {
      console.warn('AWS S3 credentials not configured. File upload features will be disabled.');
      // Create a dummy S3 instance to prevent errors
      this.s3 = new AWS.S3({
        accessKeyId: 'dummy',
        secretAccessKey: 'dummy',
        region: 'ap-south-1',
      });
      this.bucketName = '';
    }
  }

  private ensureS3Initialized(): void {
    if (!this.bucketName) {
      throw new Error('AWS S3 is not configured. Please set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_S3_BUCKET.');
    }
  }

  async uploadFile(
    key: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<string> {
    this.ensureS3Initialized();
    const params: AWS.S3.PutObjectRequest = {
      Bucket: this.bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ACL: 'private', // Make files private by default
    };

    await this.s3.putObject(params).promise();

    // Generate pre-signed URL (valid for 1 hour)
    const url = this.s3.getSignedUrl('getObject', {
      Bucket: this.bucketName,
      Key: key,
      Expires: 3600,
    });

    return url;
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    this.ensureS3Initialized();
    return this.s3.getSignedUrl('getObject', {
      Bucket: this.bucketName,
      Key: key,
      Expires: expiresIn,
    });
  }

  async getFile(key: string): Promise<Buffer> {
    this.ensureS3Initialized();
    const params: AWS.S3.GetObjectRequest = {
      Bucket: this.bucketName,
      Key: key,
    };

    const data = await this.s3.getObject(params).promise();
    return data.Body as Buffer;
  }

  async deleteFile(key: string): Promise<void> {
    this.ensureS3Initialized();
    await this.s3
      .deleteObject({
        Bucket: this.bucketName,
        Key: key,
      })
      .promise();
  }
}

