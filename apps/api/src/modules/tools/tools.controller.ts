import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { PermissionGuard } from '../rbac/permission.guard';
import { ToolsService } from './tools.service';

@ApiTags('tools')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('/api/v1')
export class ToolsController {
  constructor(private readonly tools: ToolsService) {}

  @Get('/orgs/:orgId/tools')
  @RequirePermission({ code: 'tool.read', orgParam: 'orgId' })
  listTools(@Param('orgId') orgId: string) {
    return this.tools.listTools(BigInt(orgId));
  }

  @Get('/tool-versions/:versionId/export')
  exportVersion(@Param('versionId') versionId: string) {
    return this.tools.exportToolVersion(BigInt(versionId));
  }

  @Get('/collector/tool-versions/:versionId/package')
  collectorPackage(@Param('versionId') versionId: string) {
    return this.tools.collectorPackage(BigInt(versionId));
  }
}
