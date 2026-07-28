import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.config.get('SMTP_HOST', 'smtp.gmail.com'),
      port: Number(this.config.get('SMTP_PORT', 587)),
      secure: this.config.get('SMTP_SECURE', 'false') === 'true',
      auth: {
        user: this.config.get('SMTP_USER', ''),
        pass: this.config.get('SMTP_PASS', ''),
      },
    });
  }

  async sendActivationInvite(
    to: string,
    name: string,
    activationUrl: string,
    organizationName: string,
  ): Promise<void> {
    const subject = `[CertiChain] Kích hoạt tài khoản sinh viên của bạn`;
    const html = `
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"/></head>
<body style="font-family:sans-serif;background:#f5f5f5;padding:32px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.1);">
    <div style="background:linear-gradient(135deg,#667eea,#764ba2);padding:32px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:28px;">🎓 CertiChain</h1>
      <p style="color:rgba(255,255,255,.85);margin:8px 0 0;">Nền tảng bằng cấp số hóa</p>
    </div>
    <div style="padding:32px;">
      <h2 style="color:#1a1a2e;margin-top:0;">Xin chào, ${name}!</h2>
      <p style="color:#555;line-height:1.7;">
        <strong>${organizationName}</strong> đã mời bạn tham gia hệ thống CertiChain để nhận và quản lý bằng cấp số hóa của mình.
      </p>
      <p style="color:#555;line-height:1.7;">
        Nhấn vào nút bên dưới để kích hoạt tài khoản và đặt mật khẩu. Liên kết này sẽ hết hạn sau <strong>7 ngày</strong>.
      </p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${activationUrl}"
           style="background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:16px;font-weight:600;display:inline-block;">
          ✅ Kích hoạt tài khoản
        </a>
      </div>
      <p style="color:#999;font-size:13px;border-top:1px solid #eee;padding-top:16px;">
        Nếu nút không hoạt động, copy đường dẫn sau vào trình duyệt:<br/>
        <a href="${activationUrl}" style="color:#667eea;word-break:break-all;">${activationUrl}</a>
      </p>
      <p style="color:#bbb;font-size:12px;">Nếu bạn không yêu cầu kích hoạt này, hãy bỏ qua email này.</p>
    </div>
  </div>
</body>
</html>`;
    await this.send(to, subject, html);
  }

  async sendNotificationEmail(
    to: string,
    subject: string,
    bodyHtml: string,
  ): Promise<void> {
    const html = `
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"/></head>
<body style="font-family:sans-serif;background:#f5f5f5;padding:32px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.1);">
    <div style="background:linear-gradient(135deg,#667eea,#764ba2);padding:24px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:22px;">🔔 CertiChain</h1>
    </div>
    <div style="padding:32px;">
      ${bodyHtml}
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;"/>
      <p style="color:#999;font-size:12px;text-align:center;">
        Bạn nhận email này vì đã bật thông báo email trên CertiChain.<br/>
        Bạn có thể tắt tại: Cài đặt → Thông báo
      </p>
    </div>
  </div>
</body>
</html>`;
    await this.send(to, subject, html);
  }

  async sendDisputeResultEmail(
    to: string,
    name: string,
    certTitle: string,
    status: 'APPROVED' | 'REJECTED',
    reviewerNote?: string,
  ): Promise<void> {
    const approved = status === 'APPROVED';
    const subject = approved
      ? `[CertiChain] Yêu cầu chỉnh sửa bằng cấp của bạn đã được chấp thuận`
      : `[CertiChain] Yêu cầu chỉnh sửa bằng cấp của bạn đã bị từ chối`;
    const bodyHtml = `
      <h2 style="color:#1a1a2e;">${approved ? '✅ Yêu cầu được chấp thuận' : '❌ Yêu cầu bị từ chối'}</h2>
      <p style="color:#555;line-height:1.7;">Xin chào <strong>${name}</strong>,</p>
      <p style="color:#555;line-height:1.7;">
        Yêu cầu chỉnh sửa của bạn cho bằng cấp <strong>"${certTitle}"</strong> đã được xem xét.
      </p>
      <div style="background:${approved ? '#f0fdf4' : '#fef2f2'};border:1px solid ${approved ? '#86efac' : '#fca5a5'};border-radius:8px;padding:16px;margin:16px 0;">
        <strong style="color:${approved ? '#166534' : '#991b1b'};">Kết quả: ${approved ? 'CHẤP THUẬN' : 'TỪ CHỐI'}</strong>
        ${reviewerNote ? `<p style="color:#555;margin:8px 0 0;">Ghi chú: ${reviewerNote}</p>` : ''}
      </div>
      ${approved ? '<p style="color:#555;">Bằng cấp mới đã được tạo và có thể xem trong ví của bạn.</p>' : ''}
    `;
    await this.sendNotificationEmail(to, subject, bodyHtml);
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    const from = this.config.get('SMTP_FROM', 'noreply@certichain.io');
    if (!this.config.get('SMTP_USER')) {
      this.logger.warn(
        `[MailService] SMTP_USER not configured — skipping email to ${to}. Subject: ${subject}`,
      );
      return;
    }
    try {
      await this.transporter.sendMail({ from, to, subject, html });
      this.logger.log(`[MailService] Sent email to ${to}: ${subject}`);
    } catch (err) {
      this.logger.error(`[MailService] Failed to send email to ${to}`, err);
    }
  }
}
