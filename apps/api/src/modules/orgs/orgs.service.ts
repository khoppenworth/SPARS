import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InviteUserDto } from './dto/invite-user.dto';
import { Prisma } from '@prisma/client';
import { AssignRoleDto } from './dto/assign-role.dto';

@Injectable()
export class OrgsService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(orgId: bigint) {
    const members = await this.prisma.organizationMembership.findMany({
      where: { orgId },
      include: { user: true },
      orderBy: { userId: 'asc' },
    });
    return members.map(m => ({
      userId: String(m.userId),
      email: m.user.email,
      fullName: m.user.fullName,
      status: m.status,
    }));
  }

  async inviteUser(orgId: bigint, dto: InviteUserDto) {
    // Upsert user by email
    const user = await this.prisma.user.upsert({
      where: { email: dto.email },
      update: { fullName: dto.fullName ?? undefined, status: 'active' },
      create: { email: dto.email, fullName: dto.fullName ?? null, status: 'active' },
    });

    await this.prisma.organizationMembership.upsert({
      where: { orgId_userId: { orgId, userId: user.id } },
      update: { status: 'active' },
      create: { orgId, userId: user.id, status: 'active' },
    });

    return { ok: true, userId: String(user.id), email: user.email };
  }

  async assignRole(orgId: bigint, userId: bigint, dto: AssignRoleDto) {
    const role = await this.prisma.role.findUnique({
      where: { orgId_code: { orgId, code: dto.roleCode } },
    });
    if (!role) throw new NotFoundException('Role not found in org');

    let toolId: bigint | null = null;
    if (dto.toolId) {
      toolId = BigInt(dto.toolId);
      // validate tool belongs to org
      const tool = await this.prisma.tool.findUnique({ where: { id: toolId } });
      if (!tool || tool.orgId !== orgId) throw new BadRequestException('Invalid toolId for org');
    }

    const assignment = await this.prisma.userRoleAssignment.create({
      data: {
        orgId,
        userId,
        roleId: role.id,
        toolId,
        scopeJson: dto.scope ?? Prisma.DbNull,
      },
    });

    return { ok: true, assignmentId: String(assignment.id) };
  }
}
