import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private configService: ConfigService) {}

  /**
   * Send welcome email to new user
   * TODO: Integrate with actual email service (SendGrid, AWS SES, etc.)
   */
  async sendWelcomeEmail(
    email: string,
    firstName: string,
    password: string,
  ): Promise<void> {
    const loginUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:5173',
    );

    const emailContent = `
Subject: Welcome to Ayurlahi Platform

Hello ${firstName},

Your account has been created on the Ayurlahi platform.

Login Details:
Email: ${email}
Password: ${password}

Please login at: ${loginUrl}/login

For security, please change your password after first login.

Best regards,
Ayurlahi Team
    `.trim();

    // TODO: Replace with actual email sending service
    // For now, just log the email
    this.logger.log('📧 Welcome Email (would be sent):');
    this.logger.log(`To: ${email}`);
    this.logger.log(`Subject: Welcome to Ayurlahi Platform`);
    this.logger.log(`Content: ${emailContent}`);

    // In production, integrate with:
    // - SendGrid
    // - AWS SES
    // - Nodemailer
    // - Mailgun
    // etc.
  }
}




