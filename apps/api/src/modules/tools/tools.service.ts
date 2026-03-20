import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ToolsService {
  constructor(private readonly prisma: PrismaService) {}

  async listTools(orgId: bigint) {
    const tools = await this.prisma.tool.findMany({ where: { orgId }, orderBy: { name: 'asc' } });
    return tools.map(t => ({ id: String(t.id), orgId: String(t.orgId), name: t.name, code: t.code, defaultLocale: t.defaultLocale, enabledLocales: t.enabledLocales, status: t.status }));
  }

  async exportToolVersion(versionId: bigint) {
    const tv = await this.prisma.toolVersion.findUnique({
      where: { id: versionId },
      include: {
        tool: true,
        forms: { include: { sections: { include: { questions: { include: { options: true } } } } } },
        logicRules: true,
        calculatedFields: true,
        indicators: true,
      },
    });
    if (!tv) throw new NotFoundException('Tool version not found');

    const translations = await this.prisma.translation.findMany({ where: { orgId: tv.tool.orgId } });
    const translationsByKey = new Map(
      translations.map(t => [`${String(t.entityType)}:${String(t.entityId)}:${t.locale}:${t.field}`, t.value]),
    );
    const tr = (entityType: string, entityId: bigint, locale: string, field: string, fallback: any) =>
      translationsByKey.get(`${entityType}:${String(entityId)}:${locale}:${field}`) ?? fallback;

    return {
      schemaVersion: '1.0',
      tool: { code: tv.tool.code, name: tv.tool.name, defaultLocale: tv.tool.defaultLocale, enabledLocales: tv.tool.enabledLocales },
      toolVersion: { id: String(tv.id), versionLabel: tv.versionLabel, status: tv.status, publishedAt: tv.publishedAt?.toISOString() ?? null },
      forms: tv.forms.map(f => ({
        code: f.code,
        name: f.name,
        sections: f.sections.sort((a,b)=>a.sortOrder-b.sortOrder).map(s => ({
          code: s.code,
          sortOrder: s.sortOrder,
          questions: s.questions.sort((a,b)=>a.sortOrder-b.sortOrder).map(q => ({
            code: q.code,
            type: q.questionType,
            requiredDefault: q.isRequiredDefault,
            allowNA: q.allowNa,
            naRequiresReason: q.naRequiresReason,
            constraints: q.constraintsJson,
            scoring: q.scoringJson,
            options: q.options.map(o => ({ value: o.value, sortOrder: o.sortOrder })),
          })),
        })),
      })),
      logicRules: tv.logicRules.map(r => ({ name: r.name, trigger: r.triggerExprJson, actions: r.actionsJson })),
      calculatedFields: tv.calculatedFields.map(c => ({ code: c.code, outputType: c.outputType, formula: c.formulaJson })),
      indicators: tv.indicators.map(i => ({ code: i.code, type: i.indicatorType, definition: i.definitionJson })),
      translations: translations.map(t => ({ entityType: t.entityType, entityId: String(t.entityId), locale: t.locale, field: t.field, value: t.value })),
    };
  }

  async collectorPackage(versionId: bigint) {
    const tv = await this.prisma.toolVersion.findUnique({ where: { id: versionId } });
    if (!tv) throw new NotFoundException('Tool version not found');
    if (tv.status !== 'published') throw new BadRequestException('Only published versions can be packaged');
    return this.exportToolVersion(versionId);
  }

  async createTool(orgId: bigint, dto: { name: string; code: string; defaultLocale?: string; enabledLocales?: string[] }) {
    const tool = await this.prisma.tool.create({
      data: {
        orgId,
        name: dto.name,
        code: dto.code,
        defaultLocale: dto.defaultLocale || 'en',
        enabledLocales: dto.enabledLocales || ['en'],
        status: 'active',
      },
    });
    return { id: String(tool.id), orgId: String(tool.orgId), name: tool.name, code: tool.code };
  }

  async listVersions(orgId: bigint, toolId: bigint) {
    const tool = await this.prisma.tool.findUnique({ where: { id: toolId } });
    if (!tool || tool.orgId !== orgId) throw new NotFoundException('Tool not found for org');

    const versions = await this.prisma.toolVersion.findMany({
      where: { toolId },
      orderBy: [{ createdAt: 'desc' }],
    });

    return versions.map(v => ({
      id: String(v.id),
      toolId: String(v.toolId),
      versionLabel: v.versionLabel,
      status: v.status,
      publishedAt: v.publishedAt?.toISOString() ?? null,
      createdAt: v.createdAt.toISOString(),
    }));
  }

  async createDraftVersion(orgId: bigint, toolId: bigint, dto: { versionLabel: string }) {
    const tool = await this.prisma.tool.findUnique({ where: { id: toolId } });
    if (!tool || tool.orgId !== orgId) throw new NotFoundException('Tool not found for org');

    const tv = await this.prisma.toolVersion.create({
      data: { toolId, versionLabel: dto.versionLabel, status: 'draft' },
    });
    return { id: String(tv.id), toolId: String(tv.toolId), versionLabel: tv.versionLabel, status: tv.status };
  }

  async publishVersion(orgId: bigint, toolId: bigint, versionId: bigint) {
    const tool = await this.prisma.tool.findUnique({ where: { id: toolId } });
    if (!tool || tool.orgId !== orgId) throw new NotFoundException('Tool not found for org');

    const tv = await this.prisma.toolVersion.findUnique({ where: { id: versionId } });
    if (!tv || tv.toolId !== toolId) throw new NotFoundException('Tool version not found for tool');
    if (tv.status !== 'draft') throw new BadRequestException('Only draft versions can be published');

    const updated = await this.prisma.toolVersion.update({
      where: { id: versionId },
      data: { status: 'published', publishedAt: new Date() },
    });

    return { ok: true, id: String(updated.id), status: updated.status, publishedAt: updated.publishedAt?.toISOString() ?? null };
  }


  private async assertDraftVersion(orgId: bigint, toolId: bigint, versionId: bigint) {
    const tool = await this.prisma.tool.findUnique({ where: { id: toolId } });
    if (!tool || tool.orgId !== orgId) throw new NotFoundException('Tool not found for org');
    const tv = await this.prisma.toolVersion.findUnique({ where: { id: versionId } });
    if (!tv || tv.toolId !== toolId) throw new NotFoundException('Version not found for tool');
    if (tv.status !== 'draft') throw new BadRequestException('Only draft versions can be edited');
    return tv;
  }

  async listForms(orgId: bigint, toolId: bigint, versionId: bigint) {
    const tool = await this.prisma.tool.findUnique({ where: { id: toolId } });
    if (!tool || tool.orgId !== orgId) throw new NotFoundException('Tool not found for org');
    const tv = await this.prisma.toolVersion.findUnique({ where: { id: versionId } });
    if (!tv || tv.toolId !== toolId) throw new NotFoundException('Version not found for tool');

    const forms = await this.prisma.form.findMany({
      where: { toolVersionId: versionId },
      include: {
        sections: {
          include: { questions: { include: { options: true }, orderBy: { sortOrder: 'asc' } } },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { code: 'asc' },
    });

    return forms.map(f => ({
      id: String(f.id),
      name: f.name,
      code: f.code,
      sections: f.sections.map(s => ({
        id: String(s.id),
        code: s.code,
        sortOrder: s.sortOrder,
        parentSectionId: s.parentSectionId ? String(s.parentSectionId) : null,
        questions: s.questions.map(q => ({
          id: String(q.id),
          code: q.code,
          questionType: q.questionType,
          isRequiredDefault: q.isRequiredDefault,
          allowNa: q.allowNa,
          naRequiresReason: q.naRequiresReason,
          sortOrder: q.sortOrder,
          constraintsJson: q.constraintsJson,
          scoringJson: q.scoringJson,
          options: q.options.map(o => ({ id: String(o.id), value: o.value, sortOrder: o.sortOrder })),
        })),
      })),
    }));
  }

  async createForm(orgId: bigint, toolId: bigint, versionId: bigint, dto: { name: string; code: string }) {
    await this.assertDraftVersion(orgId, toolId, versionId);
    const form = await this.prisma.form.create({ data: { toolVersionId: versionId, name: dto.name, code: dto.code } });
    return { id: String(form.id), code: form.code, name: form.name };
  }

  async createSection(orgId: bigint, formId: bigint, dto: { code: string; parentSectionId?: string; sortOrder?: number }) {
    const form = await this.prisma.form.findUnique({ where: { id: formId }, include: { toolVersion: { include: { tool: true } } } });
    if (!form) throw new NotFoundException('Form not found');
    if (form.toolVersion.tool.orgId !== orgId) throw new NotFoundException('Form not found for org');
    if (form.toolVersion.status !== 'draft') throw new BadRequestException('Only draft versions can be edited');

    const section = await this.prisma.section.create({
      data: {
        formId,
        code: dto.code,
        sortOrder: dto.sortOrder ?? 0,
        parentSectionId: dto.parentSectionId ? BigInt(dto.parentSectionId) : null,
      },
    });
    return { id: String(section.id), code: section.code, sortOrder: section.sortOrder };
  }

  async createQuestion(orgId: bigint, sectionId: bigint, dto: any) {
    const section = await this.prisma.section.findUnique({
      where: { id: sectionId },
      include: { form: { include: { toolVersion: { include: { tool: true } } } } },
    });
    if (!section) throw new NotFoundException('Section not found');
    if (section.form.toolVersion.tool.orgId !== orgId) throw new NotFoundException('Section not found for org');
    if (section.form.toolVersion.status !== 'draft') throw new BadRequestException('Only draft versions can be edited');

    const q = await this.prisma.question.create({
      data: {
        sectionId,
        code: dto.code,
        questionType: dto.questionType,
        isRequiredDefault: dto.isRequiredDefault ?? false,
        allowNa: dto.allowNa ?? false,
        naRequiresReason: dto.naRequiresReason ?? false,
        sortOrder: dto.sortOrder ?? 0,
        constraintsJson: dto.constraintsJson ?? null,
        scoringJson: dto.scoringJson ?? null,
      } as any,
    });
    return { id: String(q.id), code: q.code, questionType: q.questionType };
  }

  async createOption(orgId: bigint, questionId: bigint, dto: { value: string; sortOrder?: number }) {
    const q = await this.prisma.question.findUnique({
      where: { id: questionId },
      include: { section: { include: { form: { include: { toolVersion: { include: { tool: true } } } } } } },
    });
    if (!q) throw new NotFoundException('Question not found');
    if (q.section.form.toolVersion.tool.orgId !== orgId) throw new NotFoundException('Question not found for org');
    if (q.section.form.toolVersion.status !== 'draft') throw new BadRequestException('Only draft versions can be edited');

    const opt = await this.prisma.questionOption.create({ data: { questionId, value: dto.value, sortOrder: dto.sortOrder ?? 0 } });
    return { id: String(opt.id), value: opt.value, sortOrder: opt.sortOrder };
  }

  async previewToolVersion(orgId: bigint, toolId: bigint, versionId: bigint) {
    const tool = await this.prisma.tool.findUnique({ where: { id: toolId } });
    if (!tool || tool.orgId !== orgId) throw new NotFoundException('Tool not found for org');
    const tv = await this.prisma.toolVersion.findUnique({ where: { id: versionId } });
    if (!tv || tv.toolId !== toolId) throw new NotFoundException('Version not found for tool');
    return this.exportToolVersion(versionId);
  }


  async listLogicRules(orgId: bigint, toolId: bigint, versionId: bigint) {
    const tool = await this.prisma.tool.findUnique({ where: { id: toolId } });
    if (!tool || tool.orgId !== orgId) throw new NotFoundException('Tool not found for org');
    const tv = await this.prisma.toolVersion.findUnique({ where: { id: versionId } });
    if (!tv || tv.toolId !== toolId) throw new NotFoundException('Version not found for tool');

    const rules = await this.prisma.logicRule.findMany({
      where: { toolVersionId: versionId },
      orderBy: { id: 'asc' },
    });

    return rules.map(r => ({
      id: String(r.id),
      name: r.name,
      triggerExprJson: r.triggerExprJson,
      actionsJson: r.actionsJson,
    }));
  }

  async createLogicRule(orgId: bigint, toolId: bigint, versionId: bigint, dto: { name: string; triggerExprJson?: any; actionsJson?: any }) {
    await this.assertDraftVersion(orgId, toolId, versionId);
    const rule = await this.prisma.logicRule.create({
      data: {
        toolVersionId: versionId,
        name: dto.name,
        triggerExprJson: dto.triggerExprJson ?? {},
        actionsJson: dto.actionsJson ?? [],
      },
    });
    return {
      id: String(rule.id),
      name: rule.name,
      triggerExprJson: rule.triggerExprJson,
      actionsJson: rule.actionsJson,
    };
  }


  async listCalculatedFields(orgId: bigint, toolId: bigint, versionId: bigint) {
    const tool = await this.prisma.tool.findUnique({ where: { id: toolId } });
    if (!tool || tool.orgId !== orgId) throw new NotFoundException('Tool not found for org');
    const tv = await this.prisma.toolVersion.findUnique({ where: { id: versionId } });
    if (!tv || tv.toolId !== toolId) throw new NotFoundException('Version not found for tool');

    const rows = await this.prisma.calculatedField.findMany({
      where: { toolVersionId: versionId },
      orderBy: { id: 'asc' },
    });
    return rows.map(r => ({
      id: String(r.id),
      code: r.code,
      outputType: r.outputType,
      formulaJson: r.formulaJson,
    }));
  }

  async createCalculatedField(orgId: bigint, toolId: bigint, versionId: bigint, dto: { code: string; outputType: string; formulaJson?: any }) {
    await this.assertDraftVersion(orgId, toolId, versionId);
    const row = await this.prisma.calculatedField.create({
      data: {
        toolVersionId: versionId,
        code: dto.code,
        outputType: dto.outputType as any,
        formulaJson: dto.formulaJson ?? {},
      },
    });
    return { id: String(row.id), code: row.code, outputType: row.outputType, formulaJson: row.formulaJson };
  }

  async listIndicators(orgId: bigint, toolId: bigint, versionId: bigint) {
    const tool = await this.prisma.tool.findUnique({ where: { id: toolId } });
    if (!tool || tool.orgId !== orgId) throw new NotFoundException('Tool not found for org');
    const tv = await this.prisma.toolVersion.findUnique({ where: { id: versionId } });
    if (!tv || tv.toolId !== toolId) throw new NotFoundException('Version not found for tool');

    const rows = await this.prisma.indicator.findMany({
      where: { toolVersionId: versionId },
      orderBy: { id: 'asc' },
    });
    return rows.map(r => ({
      id: String(r.id),
      code: r.code,
      indicatorType: r.indicatorType,
      definitionJson: r.definitionJson,
    }));
  }

  async createIndicator(orgId: bigint, toolId: bigint, versionId: bigint, dto: { code: string; indicatorType: string; definitionJson?: any }) {
    await this.assertDraftVersion(orgId, toolId, versionId);
    const row = await this.prisma.indicator.create({
      data: {
        toolVersionId: versionId,
        code: dto.code,
        indicatorType: dto.indicatorType as any,
        definitionJson: dto.definitionJson ?? {},
      },
    });
    return { id: String(row.id), code: row.code, indicatorType: row.indicatorType, definitionJson: row.definitionJson };
  }


  async assignedTools(userId: bigint) {
    const assignments = await this.prisma.userRoleAssignment.findMany({
      where: { userId },
      include: {
        tool: {
          include: {
            versions: {
              where: { status: 'published' },
              orderBy: { publishedAt: 'desc' },
            },
          },
        },
        org: true,
      },
    });

    const tools = [];
    for (const a of assignments) {
      if (!a.tool) continue;
      const latestPublished = a.tool.versions[0] || null;
      tools.push({
        orgId: String(a.orgId),
        orgName: a.org.name,
        toolId: String(a.tool.id),
        toolCode: a.tool.code,
        toolName: a.tool.name,
        latestPublishedVersionId: latestPublished ? String(latestPublished.id) : null,
        latestPublishedVersionLabel: latestPublished?.versionLabel ?? null,
      });
    }
    return tools;
  }

  async collectorPackageLocalized(versionId: bigint, locale: string) {
    const tv = await this.prisma.toolVersion.findUnique({
      where: { id: versionId },
      include: {
        tool: true,
        forms: { include: { sections: { include: { questions: { include: { options: true } } } } } },
        logicRules: true,
        calculatedFields: true,
        indicators: true,
      },
    });
    if (!tv) throw new NotFoundException('Tool version not found');
    if (tv.status !== 'published') throw new BadRequestException('Only published versions can be packaged');

    const translations = await this.prisma.translation.findMany({ where: { orgId: tv.tool.orgId, locale } });
    const tmap = new Map(
      translations.map(t => [`${String(t.entityType)}:${String(t.entityId)}:${t.field}`, t.value])
    );
    const tr = (entityType: string, entityId: bigint, field: string, fallback: any) =>
      tmap.get(`${entityType}:${String(entityId)}:${field}`) ?? fallback;

    return {
      schemaVersion: '1.0',
      locale,
      tool: {
        code: tv.tool.code,
        name: tr('tool', tv.tool.id, 'label', tv.tool.name),
        defaultLocale: tv.tool.defaultLocale,
        enabledLocales: tv.tool.enabledLocales,
      },
      toolVersion: {
        id: String(tv.id),
        versionLabel: tv.versionLabel,
        status: tv.status,
        publishedAt: tv.publishedAt?.toISOString() ?? null,
      },
      forms: tv.forms.map(f => ({
        id: String(f.id),
        code: f.code,
        name: tr('form', f.id, 'label', f.name),
        sections: f.sections
          .sort((a,b)=>a.sortOrder-b.sortOrder)
          .map(s => ({
            id: String(s.id),
            code: s.code,
            title: tr('section', s.id, 'label', s.code),
            sortOrder: s.sortOrder,
            questions: s.questions
              .sort((a,b)=>a.sortOrder-b.sortOrder)
              .map(q => ({
                id: String(q.id),
                code: q.code,
                type: q.questionType,
                label: tr('question', q.id, 'label', q.code),
                helpText: tr('question', q.id, 'helpText', ''),
                requiredDefault: q.isRequiredDefault,
                allowNA: q.allowNa,
                naRequiresReason: q.naRequiresReason,
                constraints: q.constraintsJson,
                scoring: q.scoringJson,
                options: q.options.map(o => ({
                  id: String(o.id),
                  value: o.value,
                  label: tr('option', o.id, 'label', o.value),
                  sortOrder: o.sortOrder,
                })),
              })),
          })),
      })),
      logicRules: tv.logicRules.map(r => ({ name: r.name, trigger: r.triggerExprJson, actions: r.actionsJson })),
      calculatedFields: tv.calculatedFields.map(c => ({ code: c.code, outputType: c.outputType, formula: c.formulaJson })),
      indicators: tv.indicators.map(i => ({ code: i.code, type: i.indicatorType, definition: i.definitionJson })),
    };
  }

}
