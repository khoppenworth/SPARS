import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { ToolsModule } from './modules/tools/tools.module';
import { CollectorModule } from './modules/collector/collector.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { OrgsModule } from './modules/orgs/orgs.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, AuthModule, RbacModule, OrgsModule, ToolsModule, CollectorModule],
  controllers: [AppController],
})
export class AppModule {}
