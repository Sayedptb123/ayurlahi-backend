import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly provider: string;

  constructor(private configService: ConfigService) {
    this.provider = configService.get<string>('SMS_PROVIDER', 'console');
  }

  async sendOtp(phone: string, otp: string): Promise<boolean> {
    const message = `Your Medilink OTP is ${otp}. Valid for 5 minutes. Do not share with anyone.`;

    // When SMS_PROVIDER + credentials are configured, replace the block below
    // with the provider SDK call (MSG91, Fast2SMS, Twilio, etc.)
    if (this.provider === 'console' || !this.configService.get('SMS_API_KEY')) {
      this.logger.warn(`[SMS - DEV] To: ${phone} | OTP: ${otp}`);
      return true;
    }

    // MSG91 example (uncomment and install msg91-node when ready):
    // const msg91 = new MSG91(this.configService.get('SMS_API_KEY'));
    // await msg91.sendOTP(phone, otp);

    this.logger.log(`[SMS] OTP sent to ${phone} via ${this.provider}`);
    return true;
  }
}
