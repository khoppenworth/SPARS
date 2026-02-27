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
}
