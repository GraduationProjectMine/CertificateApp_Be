import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { MailService } from '../../core/mail/mail.service';

export interface CreateNotificationDto {
  student_id: string;
  organization_id: string;
  title: string;
  message: string;
  type?: string;
  event_type?: string;
  related_id?: string;
  deep_link?: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async findByStudent(studentId: string) {
    return this.prisma.notification.findMany({
      where: { student_id: studentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async countUnread(studentId: string) {
    return this.prisma.notification.count({
      where: { student_id: studentId, is_read: false },
    });
  }

  async markAsRead(id: string, studentId: string) {
    return this.prisma.notification.updateMany({
      where: { id, student_id: studentId },
      data: { is_read: true },
    });
  }

  async markAllAsRead(studentId: string) {
    return this.prisma.notification.updateMany({
      where: { student_id: studentId, is_read: false },
      data: { is_read: true },
    });
  }

  async deleteNotification(id: string, studentId: string) {
    return this.prisma.notification.deleteMany({
      where: { id, student_id: studentId },
    });
  }

  /**
   * Create a notification event (with optional email dispatch)
   */
  async createEvent(data: CreateNotificationDto) {
    const notification = await this.prisma.notification.create({
      data: {
        student_id: data.student_id,
        organization_id: data.organization_id,
        title: data.title,
        message: data.message,
        type: data.type || 'INFO',
        event_type: data.event_type,
        related_id: data.related_id,
        deep_link: data.deep_link,
        email_sent: false,
      },
    });

    // Check student's email preference and send if enabled
    const student = await this.prisma.studentAccount.findUnique({
      where: { student_id: data.student_id },
      select: { email: true, notif_email_pref: true },
    });

    if (student?.notif_email_pref) {
      try {
        await this.mailService.sendNotificationEmail(
          student.email,
          data.title,
          `<p style="color:#555;line-height:1.7;">${data.message}</p>`,
        );
        await this.prisma.notification.update({
          where: { id: notification.id },
          data: { email_sent: true },
        });
      } catch {
        // Email failure is non-blocking
      }
    }

    return notification;
  }

  /** Legacy create (kept for backward compatibility) */
  async create(data: {
    student_id: string;
    organization_id: string;
    title: string;
    message: string;
    type?: string;
    related_id?: string;
  }) {
    return this.createEvent(data);
  }

  async getPreferences(studentId: string) {
    const student = await this.prisma.studentAccount.findUnique({
      where: { student_id: studentId },
      select: { notif_email_pref: true },
    });
    return { email_notifications: student?.notif_email_pref ?? true };
  }

  async updatePreferences(
    studentId: string,
    prefs: { email_notifications: boolean },
  ) {
    await this.prisma.studentAccount.update({
      where: { student_id: studentId },
      data: { notif_email_pref: prefs.email_notifications },
    });
    return { message: 'Preferences updated' };
  }

  async findByStudentWithFilter(studentId: string, eventType?: string) {
    return this.prisma.notification.findMany({
      where: {
        student_id: studentId,
        ...(eventType ? { event_type: eventType } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}