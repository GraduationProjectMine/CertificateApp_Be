import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

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

  async create(data: {
    student_id: string;
    organization_id: string;
    title: string;
    message: string;
    type?: string;
    related_id?: string;
  }) {
    return this.prisma.notification.create({
      data: {
        student_id: data.student_id,
        organization_id: data.organization_id,
        title: data.title,
        message: data.message,
        type: data.type || 'INFO',
        related_id: data.related_id,
      },
    });
  }
}
