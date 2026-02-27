import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { PermissionGuard } from '../rbac/permission.guard';
import { InviteUserDto } from './dto/invite-user.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { OrgsService } from './orgs.service';

@ApiTags('orgs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('/api/v1')
export class OrgsController {
  constructor(private readonly orgs: OrgsService) {}

  @RequirePermission({ code: 'users.manage', orgParam: 'orgId' })
  @Get('/orgs/:orgId/users')
  listUsers(@Param('orgId') orgId: string) {
    return this.orgs.listUsers(BigInt(orgId));
  }

  @RequirePermission({ code: 'users.manage', orgParam: 'orgId' })
  @Post('/orgs/:orgId/users/invite')
  invite(@Param('orgId') orgId: string, @Body() dto: InviteUserDto) {
    return this.orgs.inviteUser(BigInt(orgId), dto);
  }

  @RequirePermission({ code: 'users.manage', orgParam: 'orgId' })
  @Post('/orgs/:orgId/users/:userId/roles')
  assignRole(@Param('orgId') orgId: string, @Param('userId') userId: string, @Body() dto: AssignRoleDto) {
    return this.orgs.assignRole(BigInt(orgId), BigInt(userId), dto);
  }
}
