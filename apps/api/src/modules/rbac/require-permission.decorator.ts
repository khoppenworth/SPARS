import { SetMetadata } from '@nestjs/common';

export const REQ_PERMISSION = 'req_permission';
export type PermissionRequirement = { code: string; orgParam?: string; toolParam?: string };

export const RequirePermission = (req: PermissionRequirement) => SetMetadata(REQ_PERMISSION, req);
