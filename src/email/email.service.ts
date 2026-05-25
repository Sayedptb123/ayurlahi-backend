import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

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
  private resend: Resend | null = null;
  private fromEmail: string;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    if (apiKey) {
      this.resend = new Resend(apiKey);
    } else {
      this.logger.warn('RESEND_API_KEY not set — email sending disabled');
    }
    this.fromEmail = this.configService.get<string>('EMAIL_FROM', 'noreply@ayurlahi.com');
  }

  async sendAppointmentReminder(data: AppointmentReminderData): Promise<boolean> {
    if (!this.resend) return false;

    try {
      await this.resend.emails.send({
        from: this.fromEmail,
        to: data.patientEmail,
        subject: `Appointment Reminder — ${data.appointmentDate} at ${data.clinicName}`,
        html: this.buildReminderHtml(data),
      });
      return true;
    } catch (err) {
      this.logger.error(`Failed to send appointment reminder: ${err.message}`);
      return false;
    }
  }

  async sendAppointmentConfirmation(data: AppointmentReminderData): Promise<boolean> {
    if (!this.resend) return false;

    try {
      await this.resend.emails.send({
        from: this.fromEmail,
        to: data.patientEmail,
        subject: `Appointment Confirmed — ${data.appointmentDate} at ${data.clinicName}`,
        html: this.buildConfirmationHtml(data),
      });
      return true;
    } catch (err) {
      this.logger.error(`Failed to send appointment confirmation: ${err.message}`);
      return false;
    }
  }

  async sendAppointmentCancellation(data: Omit<AppointmentReminderData, 'appointmentType'> & { reason?: string }): Promise<boolean> {
    if (!this.resend) return false;

    try {
      await this.resend.emails.send({
        from: this.fromEmail,
        to: data.patientEmail,
        subject: `Appointment Cancelled — ${data.clinicName}`,
        html: this.buildCancellationHtml(data),
      });
      return true;
    } catch (err) {
      this.logger.error(`Failed to send cancellation email: ${err.message}`);
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
