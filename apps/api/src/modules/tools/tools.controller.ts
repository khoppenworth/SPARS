import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { PermissionGuard } from '../rbac/permission.guard';
import { ToolsService } from './tools.service';
import { CreateToolDto } from './dto/create-tool.dto';
import { CreateVersionDto } from './dto/create-version.dto';
import { CreateFormDto } from './dto/create-form.dto';
import { CreateSectionDto } from './dto/create-section.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { CreateOptionDto } from './dto/create-option.dto';
import { CreateLogicRuleDto } from './dto/create-logic-rule.dto';
import { CreateCalculatedFieldDto } from './dto/create-calculated-field.dto';
import { CreateIndicatorDto } from './dto/create-indicator.dto';

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

  @RequirePermission({ code: 'tool.write', orgParam: 'orgId' })
  @Post('/orgs/:orgId/tools')
  createTool(@Param('orgId') orgId: string, @Body() dto: CreateToolDto) {
    return this.tools.createTool(BigInt(orgId), dto);
  }

  // Note: orgId included in path to satisfy PermissionGuard in this step
  @RequirePermission({ code: 'tool.read', orgParam: 'orgId', toolParam: 'toolId' })
  @Get('/orgs/:orgId/tools/:toolId/versions')
  listVersions(@Param('orgId') orgId: string, @Param('toolId') toolId: string) {
    return this.tools.listVersions(BigInt(orgId), BigInt(toolId));
  }

  @RequirePermission({ code: 'tool.write', orgParam: 'orgId', toolParam: 'toolId' })
  @Post('/orgs/:orgId/tools/:toolId/versions')
  createDraftVersion(@Param('orgId') orgId: string, @Param('toolId') toolId: string, @Body() dto: CreateVersionDto) {
    return this.tools.createDraftVersion(BigInt(orgId), BigInt(toolId), dto);
  }

  @RequirePermission({ code: 'tool.publish', orgParam: 'orgId', toolParam: 'toolId' })
  @Post('/orgs/:orgId/tools/:toolId/versions/:versionId/publish')
  publish(@Param('orgId') orgId: string, @Param('toolId') toolId: string, @Param('versionId') versionId: string) {
    return this.tools.publishVersion(BigInt(orgId), BigInt(toolId), BigInt(versionId));
  }


  // -------- Builder (draft versions) --------

  @RequirePermission({ code: 'tool.read', orgParam: 'orgId', toolParam: 'toolId' })
  @Get('/orgs/:orgId/tools/:toolId/versions/:versionId/preview')
  previewDraft(@Param('orgId') orgId: string, @Param('toolId') toolId: string, @Param('versionId') versionId: string) {
    return this.tools.previewToolVersion(BigInt(orgId), BigInt(toolId), BigInt(versionId));
  }

  @RequirePermission({ code: 'tool.read', orgParam: 'orgId', toolParam: 'toolId' })
  @Get('/orgs/:orgId/tools/:toolId/versions/:versionId/forms')
  listForms(@Param('orgId') orgId: string, @Param('toolId') toolId: string, @Param('versionId') versionId: string) {
    return this.tools.listForms(BigInt(orgId), BigInt(toolId), BigInt(versionId));
  }

  @RequirePermission({ code: 'tool.write', orgParam: 'orgId', toolParam: 'toolId' })
  @Post('/orgs/:orgId/tools/:toolId/versions/:versionId/forms')
  createForm(@Param('orgId') orgId: string, @Param('toolId') toolId: string, @Param('versionId') versionId: string, @Body() dto: CreateFormDto) {
    return this.tools.createForm(BigInt(orgId), BigInt(toolId), BigInt(versionId), dto);
  }

  // For these 3 routes, toolId is not in path; tool-scoped permissions will not match unless org-wide role.
  @RequirePermission({ code: 'tool.write', orgParam: 'orgId' })
  @Post('/orgs/:orgId/forms/:formId/sections')
  createSection(@Param('orgId') orgId: string, @Param('formId') formId: string, @Body() dto: CreateSectionDto) {
    return this.tools.createSection(BigInt(orgId), BigInt(formId), dto);
  }

  @RequirePermission({ code: 'tool.write', orgParam: 'orgId' })
  @Post('/orgs/:orgId/sections/:sectionId/questions')
  createQuestion(@Param('orgId') orgId: string, @Param('sectionId') sectionId: string, @Body() dto: CreateQuestionDto) {
    return this.tools.createQuestion(BigInt(orgId), BigInt(sectionId), dto);
  }

  @RequirePermission({ code: 'tool.write', orgParam: 'orgId' })
  @Post('/orgs/:orgId/questions/:questionId/options')
  createOption(@Param('orgId') orgId: string, @Param('questionId') questionId: string, @Body() dto: CreateOptionDto) {
    return this.tools.createOption(BigInt(orgId), BigInt(questionId), dto);
  }


  @RequirePermission({ code: 'tool.read', orgParam: 'orgId', toolParam: 'toolId' })
  @Get('/orgs/:orgId/tools/:toolId/versions/:versionId/rules')
  listLogicRules(@Param('orgId') orgId: string, @Param('toolId') toolId: string, @Param('versionId') versionId: string) {
    return this.tools.listLogicRules(BigInt(orgId), BigInt(toolId), BigInt(versionId));
  }

  @RequirePermission({ code: 'tool.write', orgParam: 'orgId', toolParam: 'toolId' })
  @Post('/orgs/:orgId/tools/:toolId/versions/:versionId/rules')
  createLogicRule(@Param('orgId') orgId: string, @Param('toolId') toolId: string, @Param('versionId') versionId: string, @Body() dto: CreateLogicRuleDto) {
    return this.tools.createLogicRule(BigInt(orgId), BigInt(toolId), BigInt(versionId), dto);
  }


  @RequirePermission({ code: 'tool.read', orgParam: 'orgId', toolParam: 'toolId' })
  @Get('/orgs/:orgId/tools/:toolId/versions/:versionId/calculated-fields')
  listCalculatedFields(@Param('orgId') orgId: string, @Param('toolId') toolId: string, @Param('versionId') versionId: string) {
    return this.tools.listCalculatedFields(BigInt(orgId), BigInt(toolId), BigInt(versionId));
  }

  @RequirePermission({ code: 'tool.write', orgParam: 'orgId', toolParam: 'toolId' })
  @Post('/orgs/:orgId/tools/:toolId/versions/:versionId/calculated-fields')
  createCalculatedField(@Param('orgId') orgId: string, @Param('toolId') toolId: string, @Param('versionId') versionId: string, @Body() dto: CreateCalculatedFieldDto) {
    return this.tools.createCalculatedField(BigInt(orgId), BigInt(toolId), BigInt(versionId), dto);
  }

  @RequirePermission({ code: 'tool.read', orgParam: 'orgId', toolParam: 'toolId' })
  @Get('/orgs/:orgId/tools/:toolId/versions/:versionId/indicators')
  listIndicators(@Param('orgId') orgId: string, @Param('toolId') toolId: string, @Param('versionId') versionId: string) {
    return this.tools.listIndicators(BigInt(orgId), BigInt(toolId), BigInt(versionId));
  }

  @RequirePermission({ code: 'tool.write', orgParam: 'orgId', toolParam: 'toolId' })
  @Post('/orgs/:orgId/tools/:toolId/versions/:versionId/indicators')
  createIndicator(@Param('orgId') orgId: string, @Param('toolId') toolId: string, @Param('versionId') versionId: string, @Body() dto: CreateIndicatorDto) {
    return this.tools.createIndicator(BigInt(orgId), BigInt(toolId), BigInt(versionId), dto);
  }


  @Get('/collector/assigned-tools')
  assignedTools(@Req() req: any) {
    return this.tools.assignedTools(BigInt(String(req.user.userId)));
  }

  @Get('/collector/tool-versions/:versionId/package-localized')
  localizedCollectorPackage(@Param('versionId') versionId: string, @Query('locale') locale: string) {
    return this.tools.collectorPackageLocalized(BigInt(versionId), locale || 'en');
  }

}
