import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpsertTranslationDto } from './dto/upsert-translation.dto';

@Injectable()
export class TranslationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(orgId: bigint, locale?: string) {
    const where: any = { orgId };
    if (locale) where.locale = locale;
    const rows = await this.prisma.translation.findMany({
      where,
      orderBy: [{ locale: 'asc' }, { entityType: 'asc' }, { entityId: 'asc' }, { field: 'asc' }],
    });
    return rows.map(r => ({
      id: String(r.id),
      entityType: r.entityType,
      entityId: String(r.entityId),
      locale: r.locale,
      field: r.field,
      value: r.value,
    }));
  }

  async upsert(orgId: bigint, dto: UpsertTranslationDto) {
    const entityId = BigInt(dto.entityId);
    const row = await this.prisma.translation.upsert({
      where: {
        entityType_entityId_locale_field: {
          entityType: dto.entityType as any,
          entityId,
          locale: dto.locale,
          field: dto.field,
        },
      },
      update: { value: dto.value },
      create: {
        orgId,
        entityType: dto.entityType as any,
        entityId,
        locale: dto.locale,
        field: dto.field,
        value: dto.value,
      },
    });
    return {
      id: String(row.id),
      entityType: row.entityType,
      entityId: String(row.entityId),
      locale: row.locale,
      field: row.field,
      value: row.value,
    };
  }
}
