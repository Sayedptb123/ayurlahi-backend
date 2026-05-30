import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

interface AppointmentReminderData {
  patientName: string;
  patientEmail: string;
  doctorName: string;
  clinicName: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentType: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private fromEmail: string;

  constructor(private configService: ConfigService) {
    const host = this.configService.get<string>('EMAIL_HOST');
    const user = this.configService.get<string>('EMAIL_USER');
    const pass = this.configService.get<string>('EMAIL_PASS');

    this.fromEmail = this.configService.get<string>('EMAIL_FROM', 'Ayurlahi <noreply@ayurlahi.com>');

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port: this.configService.get<number>('EMAIL_PORT') ?? 587,
        secure: false,
        auth: { user, pass },
        connectionTimeout: 8000,  // 8s to establish TCP connection
        greetingTimeout: 8000,    // 8s for SMTP greeting
        socketTimeout: 10000,     // 10s of inactivity before abort
      });
      this.logger.log(`Email service ready via ${host}`);
      // Verify SMTP connection at startup
      this.transporter.verify().then(() => {
        this.logger.log('SMTP connection verified OK');
      }).catch((err) => {
        this.logger.error(`SMTP connection failed: ${err.message}`);
      });
    } else {
      this.logger.warn('EMAIL_HOST / EMAIL_USER / EMAIL_PASS not set — email sending in console-log mode');
    }
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(`[EMAIL - DEV] To: ${to} | Subject: ${subject}`);
      return;
    }
    this.logger.log(`Sending email to ${to} — subject: "${subject}"`);
    try {
      const info = await this.transporter.sendMail({ from: this.fromEmail, to, subject, html });
      this.logger.log(`Email sent OK — messageId: ${info.messageId}`);
    } catch (err: any) {
      this.logger.error(`Failed to send email to ${to}: ${err.message} (code: ${err.code})`);
      throw err;
    }
  }

  async sendOtp(email: string, otp: string): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(`[EMAIL - DEV] To: ${email} | OTP: ${otp}`);
      return;
    }
    await this.send(email, 'Your Ayurlahi OTP', `
      <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:24px;">
        <div style="background:#0ea5e9;padding:20px;border-radius:8px 8px 0 0;">
          <h1 style="color:#fff;margin:0;font-size:20px;">Your OTP</h1>
        </div>
        <div style="border:1px solid #e2e8f0;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
          <p>Your one-time password is:</p>
          <p style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#0ea5e9;text-align:center;margin:24px 0;">${otp}</p>
          <p style="color:#64748b;font-size:13px;">Valid for 5 minutes. Do not share this with anyone.</p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0">
          <p style="color:#94a3b8;font-size:11px;text-align:center;">Ayurlahi Health Technologies — Medilink</p>
        </div>
      </div>
    `);
  }

  async sendAppointmentReminder(data: AppointmentReminderData): Promise<boolean> {
    try {
      await this.send(
        data.patientEmail,
        `Appointment Reminder — ${data.appointmentDate} at ${data.clinicName}`,
        this.buildReminderHtml(data),
      );
      return true;
    } catch {
      return false;
    }
  }

  async sendAppointmentConfirmation(data: AppointmentReminderData): Promise<boolean> {
    try {
      await this.send(
        data.patientEmail,
        `Appointment Confirmed — ${data.appointmentDate} at ${data.clinicName}`,
        this.buildConfirmationHtml(data),
      );
      return true;
    } catch {
      return false;
    }
  }

  async sendAppointmentCancellation(data: Omit<AppointmentReminderData, 'appointmentType'> & { reason?: string }): Promise<boolean> {
    try {
      await this.send(
        data.patientEmail,
        `Appointment Cancelled — ${data.clinicName}`,
        this.buildCancellationHtml(data),
      );
      return true;
    } catch {
      return false;
    }
  }

  private buildReminderHtml(data: AppointmentReminderData): string {
    return `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <div style="background:#0ea5e9;padding:20px;border-radius:8px 8px 0 0;">
          <h1 style="color:#fff;margin:0;font-size:20px;">Appointment Reminder</h1>
        </div>
        <div style="border:1px solid #e2e8f0;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
          <p>Dear <strong>${data.patientName}</strong>,</p>
          <p>This is a reminder for your upcoming appointment:</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr><td style="padding:8px;background:#f8fafc;font-weight:bold;width:40%">Clinic</td><td style="padding:8px">${data.clinicName}</td></tr>
            <tr><td style="padding:8px;font-weight:bold">Doctor</td><td style="padding:8px">Dr. ${data.doctorName}</td></tr>
            <tr><td style="padding:8px;background:#f8fafc;font-weight:bold">Date</td><td style="padding:8px">${data.appointmentDate}</td></tr>
            <tr><td style="padding:8px;font-weight:bold">Time</td><td style="padding:8px">${data.appointmentTime}</td></tr>
            <tr><td style="padding:8px;background:#f8fafc;font-weight:bold">Type</td><td style="padding:8px">${data.appointmentType}</td></tr>
          </table>
          <p style="color:#64748b;font-size:12px;">Please arrive 10 minutes early. If you need to reschedule, contact us as soon as possible.</p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0">
          <p style="color:#94a3b8;font-size:11px;text-align:center;">Ayurlahi Health Technologies — Medilink</p>
        </div>
      </div>
    `;
  }

  private buildConfirmationHtml(data: AppointmentReminderData): string {
    return `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <div style="background:#22c55e;padding:20px;border-radius:8px 8px 0 0;">
          <h1 style="color:#fff;margin:0;font-size:20px;">Appointment Confirmed</h1>
        </div>
        <div style="border:1px solid #e2e8f0;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
          <p>Dear <strong>${data.patientName}</strong>,</p>
          <p>Your appointment has been confirmed:</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr><td style="padding:8px;background:#f8fafc;font-weight:bold;width:40%">Clinic</td><td style="padding:8px">${data.clinicName}</td></tr>
            <tr><td style="padding:8px;font-weight:bold">Doctor</td><td style="padding:8px">Dr. ${data.doctorName}</td></tr>
            <tr><td style="padding:8px;background:#f8fafc;font-weight:bold">Date</td><td style="padding:8px">${data.appointmentDate}</td></tr>
            <tr><td style="padding:8px;font-weight:bold">Time</td><td style="padding:8px">${data.appointmentTime}</td></tr>
          </table>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0">
          <p style="color:#94a3b8;font-size:11px;text-align:center;">Ayurlahi Health Technologies — Medilink</p>
        </div>
      </div>
    `;
  }

  private buildCancellationHtml(data: Omit<AppointmentReminderData, 'appointmentType'> & { reason?: string }): string {
    return `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <div style="background:#ef4444;padding:20px;border-radius:8px 8px 0 0;">
          <h1 style="color:#fff;margin:0;font-size:20px;">Appointment Cancelled</h1>
        </div>
        <div style="border:1px solid #e2e8f0;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
          <p>Dear <strong>${data.patientName}</strong>,</p>
          <p>Your appointment on <strong>${data.appointmentDate}</strong> at <strong>${data.clinicName}</strong> has been cancelled.</p>
          ${data.reason ? `<p>Reason: ${data.reason}</p>` : ''}
          <p>Please contact us to reschedule at your earliest convenience.</p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0">
          <p style="color:#94a3b8;font-size:11px;text-align:center;">Ayurlahi Health Technologies — Medilink</p>
        </div>
      </div>
    `;
  }
}
