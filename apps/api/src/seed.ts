import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service';
import { SeedService } from './seed.service';

async function seed() {
  const prisma = new PrismaService();
  const config = new ConfigService();
  await prisma.$connect();
  await new SeedService(prisma, config).seed();
  await prisma.$disconnect();
}

void seed();
