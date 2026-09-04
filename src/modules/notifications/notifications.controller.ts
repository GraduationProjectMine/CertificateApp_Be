import {
  Controller,
  Get,
  Put,
  Param,
  Req,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get student notifications' })
  async findAll(@Req() req: Request) {
    const user = req.user as any;
    if (user.role !== 'student')
      throw new ForbiddenException('Only students can view notifications');
    const studentId = user.id || user.sub;
    return this.notificationsService.findByStudent(studentId);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  async unreadCount(@Req() req: Request) {
    const user = req.user as any;
    if (user.role !== 'student')
      throw new ForbiddenException('Only students can view notifications');
    const studentId = user.id || user.sub;
    const count = await this.notificationsService.countUnread(studentId);
    return { count };
  }

  @Put(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  async markAsRead(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as any;
    if (user.role !== 'student')
      throw new ForbiddenException('Only students can mark notifications');
    const studentId = user.id || user.sub;
    await this.notificationsService.markAsRead(id, studentId);
    return { message: 'Marked as read' };
  }

  @Put('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllAsRead(@Req() req: Request) {
    const user = req.user as any;
    if (user.role !== 'student')
      throw new ForbiddenException('Only students can mark notifications');
    const studentId = user.id || user.sub;
    await this.notificationsService.markAllAsRead(studentId);
    return { message: 'All notifications marked as read' };
  }
}
