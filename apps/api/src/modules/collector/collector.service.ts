import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RuleEngineService, ResponseState } from './rule-engine.service';
import { ScoringEngineService } from './scoring-engine.service';
import { CreateVisitDto } from './dto/create-visit.dto';
import { UpsertResponseDto } from './dto/upsert-response.dto';

@Injectable()
export class CollectorService {
  constructor(private readonly prisma: PrismaService, private readonly ruleEngine: RuleEngineService, private readonly scoringEngine: ScoringEngineService) {}

  async createVisit(userId: string, dto: CreateVisitDto) {
    const uid = BigInt(userId);
    const orgId = BigInt(dto.orgId);
    const toolVersionId = BigInt(dto.toolVersionId);
    const facilityId = BigInt(dto.facilityId);

    const membership = await this.prisma.organizationMembership.findUnique({ where: { orgId_userId: { orgId, userId: uid } } });
    if (!membership || membership.status !== 'active') throw new ForbiddenException('Not a member of org');

    const tv = await this.prisma.toolVersion.findUnique({ where: { id: toolVersionId } });
    if (!tv || tv.status !== 'published') throw new BadRequestException('Tool version must be published');

    const visit = await this.prisma.supervisionVisit.create({
      data: { orgId, toolVersionId, facilityId, collectorUserId: uid, visitDate: new Date(dto.visitDate), deviceId: dto.deviceId, status: 'draft' },
    });
    return { visitId: String(visit.id), status: visit.status };
  }

  async upsertResponse(userId: string, visitId: bigint, dto: UpsertResponseDto) {
    const uid = BigInt(userId);
    const visit = await this.prisma.supervisionVisit.findUnique({ where: { id: visitId } });
    if (!visit) throw new NotFoundException('Visit not found');
    if (visit.collectorUserId !== uid) throw new ForbiddenException('Not your visit');
    if (visit.status !== 'draft') throw new BadRequestException('Visit not editable');

    const questionId = BigInt(dto.questionId);

    await this.prisma.visitResponse.upsert({
      where: { visitId_questionId: { visitId, questionId } },
      update: { answerJson: dto.answerJson ?? undefined, isNa: dto.isNa ?? undefined, naReason: dto.naReason ?? undefined, isHidden: dto.isHidden ?? undefined },
      create: { visitId, questionId, answerJson: dto.answerJson ?? null, isNa: dto.isNa ?? false, naReason: dto.naReason ?? null, isHidden: dto.isHidden ?? false },
    });

    return { ok: true };
  }

  async submit(userId: string, visitId: bigint) {
    const uid = BigInt(userId);
    const visit = await this.prisma.supervisionVisit.findUnique({
      where: { id: visitId },
      include: {
        toolVersion: {
          include: {
            indicators: true,
            logicRules: true,
            calculatedFields: true,
          },
        },
        responses: {
          include: {
            question: {
              include: { section: true },
            },
          },
        },
      },
    });
    if (!visit) throw new NotFoundException('Visit not found');
    if (visit.collectorUserId !== uid) throw new ForbiddenException('Not your visit');
    if (visit.status !== 'draft') throw new BadRequestException('Already submitted');

    const now = new Date();

    const state: ResponseState[] = visit.responses.map(r => ({
      questionCode: r.question.code,
      answerJson: r.answerJson as any,
      isNa: r.isNa,
      naReason: r.naReason,
      isHidden: r.isHidden,
      isRequired: r.question.isRequiredDefault,
      sectionCode: r.question.section.code,
    }));

    const evaluated = this.ruleEngine.applyRules(
      visit.toolVersion.logicRules.map(rule => ({
        triggerExprJson: rule.triggerExprJson as any,
        actionsJson: rule.actionsJson as any,
      })),
      state,
    );

    const scoringInput = evaluated.map(s => {
      const original = visit.responses.find(r => r.question.code === s.questionCode);
      return {
        questionCode: s.questionCode,
        answerJson: s.answerJson,
        isNa: s.isNa,
        isHidden: s.isHidden,
        scoringJson: original?.question.scoringJson as any,
      };
    });

    const scoreResult = this.scoringEngine.compute(
      scoringInput,
      visit.toolVersion.calculatedFields.map(cf => ({
        code: cf.code,
        outputType: cf.outputType,
        formulaJson: cf.formulaJson as any,
      })),
      visit.toolVersion.indicators.map(ind => ({
        code: ind.code,
        indicatorType: ind.indicatorType,
        definitionJson: ind.definitionJson as any,
      })),
    );

    await this.prisma.$transaction(async (tx) => {
      for (const s of evaluated) {
        const original = visit.responses.find(r => r.question.code === s.questionCode);
        if (!original) continue;
        await tx.visitResponse.update({
          where: { visitId_questionId: { visitId, questionId: original.questionId } },
          data: { isNa: s.isNa, isHidden: s.isHidden },
        });
      }

      await tx.visitScore.deleteMany({ where: { visitId } });
      for (const vs of scoreResult.visitScores) {
        await tx.visitScore.create({
          data: {
            visitId,
            indicatorCode: vs.indicatorCode,
            valuePercent: vs.valuePercent,
            valueScore: vs.valueScore,
            detailsJson: vs.detailsJson,
          },
        });
      }

      await tx.supervisionVisit.update({
        where: { id: visitId },
        data: { status: 'submitted', submittedAt: now },
      });
    });

    return {
      ok: true,
      status: 'submitted',
      submittedAt: now.toISOString(),
      rulesApplied: true,
      computedIndicators: scoreResult.visitScores.length,
    };
  }

  async batchUpsertResponses(userId: string, visitId: bigint, dto: { items: any[] }) {
    const uid = BigInt(userId);
    const visit = await this.prisma.supervisionVisit.findUnique({ where: { id: visitId } });
    if (!visit) throw new NotFoundException('Visit not found');
    if (visit.collectorUserId !== uid) throw new ForbiddenException('Not your visit');
    if (visit.status !== 'draft') throw new BadRequestException('Visit is not editable');

    for (const item of dto.items || []) {
      const questionId = BigInt(item.questionId);
      await this.prisma.visitResponse.upsert({
        where: { visitId_questionId: { visitId, questionId } },
        update: {
          answerJson: item.answerJson ?? undefined,
          isNa: item.isNa ?? undefined,
          naReason: item.naReason ?? undefined,
          isHidden: item.isHidden ?? undefined,
        },
        create: {
          visitId,
          questionId,
          answerJson: item.answerJson ?? null,
          isNa: item.isNa ?? false,
          naReason: item.naReason ?? null,
          isHidden: item.isHidden ?? false,
        },
      });
    }

    return { ok: true, count: (dto.items || []).length };
  }

}
