import { Controller, Get, Header, Param } from '@nestjs/common';
import { PublicService } from './public.service';

@Controller('public/v1/reports')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get(':token')
  @Header('Cache-Control', 'private, no-store')
  @Header('Referrer-Policy', 'no-referrer')
  report(@Param('token') token: string) {
    return this.publicService.getReport(token);
  }
}
