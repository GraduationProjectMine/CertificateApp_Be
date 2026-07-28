import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  ForbiddenException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsService } from './notifications.service';
import { IsBoolean } from 'class-validator';

class UpdatePreferencesDto {
  @IsBoolean()
  email_notifications: boolean;
}

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get student notifications (optionally filtered by event_type)' })
  async findAll(@Req() req: Request, @Query('event_type') eventType?: string) {
    const user = req.user as any;
    if (user.role !== 'student')
      throw new ForbiddenException('Only students can view notifications');
    return this.notificationsService.findByStudentWithFilter(user.sub, eventType);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  async unreadCount(@Req() req: Request) {
    const user = req.user as any;
    if (user.role !== 'student')
      throw new ForbiddenException('Only students can view notifications');
    const count = await this.notificationsService.countUnread(user.sub);
    return { count };
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Get notification preferences' })
  async getPreferences(@Req() req: Request) {
    const user = req.user as any;
    if (user.role !== 'student')
      throw new ForbiddenException('Only students can view notification preferences');
    return this.notificationsService.getPreferences(user.sub);
  }

  @Put('preferences')
  @ApiOperation({ summary: 'Update notification preferences' })
  async updatePreferences(
    @Req() req: Request,
    @Body() body: UpdatePreferencesDto,
  ) {
    const user = req.user as any;
    if (user.role !== 'student')
      throw new ForbiddenException('Only students can update notification preferences');
    return this.notificationsService.updatePreferences(user.sub, {
      email_notifications: body.email_notifications,
    });
  }

  @Put('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllAsRead(@Req() req: Request) {
    const user = req.user as any;
    if (user.role !== 'student')
      throw new ForbiddenException('Only students can mark notifications');
    await this.notificationsService.markAllAsRead(user.sub);
    return { message: 'All notifications marked as read' };
  }

  @Put(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  async markAsRead(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as any;
    if (user.role !== 'student')
      throw new ForbiddenException('Only students can mark notifications');
    await this.notificationsService.markAsRead(id, user.sub);
    return { message: 'Marked as read' };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a notification' })
  async deleteNotification(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as any;
    if (user.role !== 'student')
      throw new ForbiddenException('Only students can delete notifications');
    await this.notificationsService.deleteNotification(id, user.sub);
    return { message: 'Notification deleted' };
  }
}