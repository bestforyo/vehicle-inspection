import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from './prisma.service';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PlatformController } from './platform.controller';
import { HealthController } from './health.controller';
import { StorageService } from './storage.service';
import { AuthController } from './auth.controller';
import { AuthGuard, AuthService } from './auth';
import { BusinessController } from './business.controller';
import { BusinessService } from './business.service';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';
import { SeedService } from './seed.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ secret: config.getOrThrow<string>('JWT_SECRET') }),
    }),
  ],
  controllers: [AuthController, BusinessController, MediaController, PublicController, AdminController, PlatformController, HealthController],
  providers: [PrismaService, AuthService, AuthGuard, BusinessService, MediaService, PublicService, SeedService, AdminService, StorageService],
})
export class AppModule {}
