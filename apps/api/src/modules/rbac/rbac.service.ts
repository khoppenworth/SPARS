import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * RBAC is stored as:
 * user_role_assignments (orgId, userId, roleId, toolId?)
 * role_permissions (roleId, permissionId)
 * permissions (code)
 *
 * This service answers: does user have permissionCode in org scope (and optionally tool scope)?
 */
@Injectable()
export class RbacService {
  constructor(private readonly prisma: PrismaService) {}

  async userHasPermission(args: {
    userId: bigint;
    orgId: bigint;
    permissionCode: string;
    toolId?: bigint | null;
  }): Promise<boolean> {
    const { userId, orgId, permissionCode, toolId } = args;

    // Allow org-wide assignment (toolId null) OR tool-specific assignment if toolId provided.
    const assignments = await this.prisma.userRoleAssignment.findMany({
      where: {
        orgId,
        userId,
        OR: toolId ? [{ toolId: null }, { toolId }] : [{ toolId: null }],
      },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    for (const a of assignments) {
      for (const rp of a.role.rolePermissions) {
        if (rp.permission.code === permissionCode) return true;
      }
    }
    return false;
  }
}
