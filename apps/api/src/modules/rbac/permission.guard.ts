import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RbacService } from './rbac.service';
import { REQ_PERMISSION, PermissionRequirement } from './require-permission.decorator';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly rbac: RbacService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const reqPerm = this.reflector.getAllAndOverride<PermissionRequirement>(REQ_PERMISSION, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!reqPerm) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user?.userId) throw new ForbiddenException('Not authenticated');

    const params = request.params || {};
    const orgParam = reqPerm.orgParam || 'orgId';
    const toolParam = reqPerm.toolParam || 'toolId';

    const orgIdStr = params[orgParam] || request.body?.orgId;
    if (!orgIdStr) throw new ForbiddenException('Missing orgId');
    const orgId = BigInt(String(orgIdStr));

    const toolIdStr = params[toolParam] || request.body?.toolId;
    const toolId = toolIdStr ? BigInt(String(toolIdStr)) : null;

    const ok = await this.rbac.userHasPermission({
      userId: BigInt(String(user.userId)),
      orgId,
      permissionCode: reqPerm.code,
      toolId,
    });
    if (!ok) throw new ForbiddenException('Insufficient permission');
    return true;
  }
}
