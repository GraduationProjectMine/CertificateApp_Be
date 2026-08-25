import {
  Controller,
  Get,
  Put,
  Param,
  Req,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request.interface';
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
  async findAll(@Req() req: AuthenticatedRequest) {
    const user = req.user;
    if (user.role !== 'student')
      throw new ForbiddenException('Only students can view notifications');
    return this.notificationsService.findByStudent(user.id);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  async unreadCount(@Req() req: AuthenticatedRequest) {
    const user = req.user;
    if (user.role !== 'student')
      throw new ForbiddenException('Only students can view notifications');
    const count = await this.notificationsService.countUnread(user.id);
    return { count };
  }

  @Put(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  async markAsRead(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const user = req.user;
    if (user.role !== 'student')
      throw new ForbiddenException('Only students can mark notifications');
    await this.notificationsService.markAsRead(id, user.id);
    return { message: 'Marked as read' };
  }

  @Put('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllAsRead(@Req() req: AuthenticatedRequest) {
    const user = req.user;
    if (user.role !== 'student')
      throw new ForbiddenException('Only students can mark notifications');
    await this.notificationsService.markAllAsRead(user.id);
    return { message: 'All notifications marked as read' };
  }
}
