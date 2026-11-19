import { Body, Controller, Get, Param, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AuthGuard, CurrentUser, type AuthUser } from './auth';
import { MediaService } from './media.service';
import { PublicService } from './public.service';

@Controller()
export class MediaController {
  constructor(private readonly media: MediaService, private readonly publicService: PublicService) {}

  @Post('api/v1/media/upload')
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 12 * 1024 * 1024, files: 1 } }))
  upload(@CurrentUser() user: AuthUser, @UploadedFile() file: Express.Multer.File, @Body() body: { orderId: string; itemKey: string }) {
    return this.media.upload(user, file, body.orderId, body.itemKey);
  }

  @Get('api/v1/media/:assetId/preview-url')
  @UseGuards(AuthGuard)
  preview(@CurrentUser() user: AuthUser, @Param('assetId') assetId: string) {
    if (!user.tenantId) return null;
    return this.media.signedPreviewUrl(user, assetId);
  }

  @Get('api/v1/media/:assetId/content')
  async content(@Param('assetId') assetId: string, @Query('expires') expires: string, @Query('signature') signature: string, @Res() response: Response) {
    const file = await this.media.readSigned(assetId, Number(expires), signature ?? '');
    response.setHeader('Content-Type', file.mime);
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.send(file.buffer);
  }

  @Get('public/v1/reports/:token/assets/:assetId/preview')
  async publicContent(@Param('token') token: string, @Param('assetId') assetId: string, @Res() response: Response) {
    await this.publicService.assertAssetAccess(token, assetId);
    const file = await this.media.readPublic(assetId);
    response.setHeader('Content-Type', file.mime);
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.send(file.buffer);
  }
}
