import { Body, Controller, Get, Headers, HttpCode, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import type { StandardCode } from '@jianjian/contracts';
import { AuthGuard, CurrentUser, type AuthUser } from './auth';
import { BusinessService } from './business.service';

@Controller('api/v1')
@UseGuards(AuthGuard)
export class BusinessController {
  constructor(private readonly business: BusinessService) {}

  @Get('templates')
  templates(@CurrentUser() user: AuthUser, @Query('standard') standard: StandardCode = 'GROUP') {
    return this.business.listTemplates(user, standard);
  }

  @Get('templates/:templateId/revisions/:revisionId')
  template(@CurrentUser() user: AuthUser, @Param('revisionId') revisionId: string) {
    return this.business.getTemplate(user, revisionId);
  }

  @HttpCode(200)
  @Post('orders')
  createOrder(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>, @Headers('idempotency-key') key?: string) {
    return this.business.createOrder(user, body, key);
  }

  @Get('orders')
  orders(@CurrentUser() user: AuthUser, @Query('status') status?: string) {
    return this.business.listOrders(user, status);
  }

  @Get('orders/:orderId')
  order(@CurrentUser() user: AuthUser, @Param('orderId') orderId: string) {
    return this.business.getOrder(user, orderId);
  }

  @Patch('orders/:orderId/vehicle')
  vehicle(@CurrentUser() user: AuthUser, @Param('orderId') orderId: string, @Body() body: Record<string, unknown>) {
    return this.business.updateVehicle(user, orderId, body);
  }

  @Get('orders/:orderId/inspection/current')
  inspection(@CurrentUser() user: AuthUser, @Param('orderId') orderId: string) {
    return this.business.getInspection(user, orderId);
  }

  @Put('orders/:orderId/inspection/draft')
  draft(@CurrentUser() user: AuthUser, @Param('orderId') orderId: string, @Body() body: { lockVersion?: number; answers?: [] }) {
    return this.business.saveDraft(user, orderId, body);
  }

  @HttpCode(200)
  @Post('orders/:orderId/inspection/submit')
  submit(@CurrentUser() user: AuthUser, @Param('orderId') orderId: string, @Body() body: { lockVersion?: number }) {
    return this.business.submitInspection(user, orderId, body);
  }

  @Get('reviews')
  reviews(@CurrentUser() user: AuthUser) {
    return this.business.listReviews(user);
  }

  @Get('orders/:orderId/reviews')
  reviewHistory(@CurrentUser() user: AuthUser, @Param('orderId') orderId: string) {
    return this.business.reviewHistory(user, orderId);
  }

  @HttpCode(200)
  @Post('orders/:orderId/reviews/:revisionId/return')
  returnReview(@CurrentUser() user: AuthUser, @Param('orderId') orderId: string, @Param('revisionId') revisionId: string, @Body() body: { comment?: string; targetItemKeys?: string[] }) {
    return this.business.returnReview(user, orderId, revisionId, body);
  }

  @HttpCode(200)
  @Post('orders/:orderId/reviews/:revisionId/approve')
  approveReview(@CurrentUser() user: AuthUser, @Param('orderId') orderId: string, @Param('revisionId') revisionId: string) {
    return this.business.approveReview(user, orderId, revisionId);
  }

  @Get('orders/:orderId/reports')
  orderReports(@CurrentUser() user: AuthUser, @Param('orderId') orderId: string) {
    return this.business.listReports(user, orderId);
  }

  @Get('reports')
  reports(@CurrentUser() user: AuthUser) {
    return this.business.listReports(user);
  }

  @Get('reports/:reportId')
  async report(@CurrentUser() user: AuthUser, @Param('reportId') reportId: string) {
    const reports = await this.business.listReports(user);
    const report = reports.find((entry) => entry.id === reportId);
    if (!report) return null;
    return report;
  }

  @HttpCode(200)
  @Post('reports/:reportId/shares')
  createShare(@CurrentUser() user: AuthUser, @Param('reportId') reportId: string, @Body() body: { expiresInDays?: number }) {
    return this.business.createShare(user, reportId, body.expiresInDays);
  }

  @HttpCode(200)
  @Post('reports/:reportId/shares/:shareId/revoke')
  revokeShare(@CurrentUser() user: AuthUser, @Param('reportId') reportId: string, @Param('shareId') shareId: string) {
    return this.business.revokeShare(user, reportId, shareId);
  }
}
