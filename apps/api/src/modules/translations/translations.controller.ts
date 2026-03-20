import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { PermissionGuard } from '../rbac/permission.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { TranslationsService } from './translations.service';
import { UpsertTranslationDto } from './dto/upsert-translation.dto';

@ApiTags('translations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('/api/v1')
export class TranslationsController {
  constructor(private readonly translations: TranslationsService) {}

  @RequirePermission({ code: 'tool.read', orgParam: 'orgId' })
  @Get('/orgs/:orgId/translations')
  list(@Param('orgId') orgId: string, @Query('locale') locale?: string) {
    return this.translations.list(BigInt(orgId), locale);
  }

  @RequirePermission({ code: 'tool.write', orgParam: 'orgId' })
  @Post('/orgs/:orgId/translations')
  upsert(@Param('orgId') orgId: string, @Body() dto: UpsertTranslationDto) {
    return this.translations.upsert(BigInt(orgId), dto);
  }
}
