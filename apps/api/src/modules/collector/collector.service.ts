import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateVisitDto } from './dto/create-visit.dto';
import { UpsertResponseDto } from './dto/upsert-response.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class CollectorService {
  constructor(private readonly prisma: PrismaService) {}

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
      create: { visitId, questionId, answerJson: dto.answerJson ?? Prisma.DbNull, isNa: dto.isNa ?? false, naReason: dto.naReason ?? null, isHidden: dto.isHidden ?? false },
    });

    return { ok: true };
  }

  async submit(userId: string, visitId: bigint) {
    const uid = BigInt(userId);
    const visit = await this.prisma.supervisionVisit.findUnique({ where: { id: visitId }, include: { toolVersion: { include: { indicators: true } } } });
    if (!visit) throw new NotFoundException('Visit not found');
    if (visit.collectorUserId !== uid) throw new ForbiddenException('Not your visit');
    if (visit.status !== 'draft') throw new BadRequestException('Already submitted');

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.supervisionVisit.update({ where: { id: visitId }, data: { status: 'submitted', submittedAt: now } });

      // Placeholder score
      const overall = visit.toolVersion.indicators.find(i => i.indicatorType === 'overall');
      if (overall) {
        await tx.visitScore.upsert({
          where: { visitId_indicatorCode: { visitId, indicatorCode: overall.code } },
          update: { valuePercent: 0, valueScore: 0, detailsJson: { note: 'placeholder' } },
          create: { visitId, indicatorCode: overall.code, valuePercent: 0, valueScore: 0, detailsJson: { note: 'placeholder' } },
        });
      }
    });

    return { ok: true, status: 'submitted', submittedAt: now.toISOString() };
  }
}
