import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.upsert({
    where: { code: 'SYSTEMSDELIGHT' },
    update: {},
    create: { code: 'SYSTEMSDELIGHT', name: 'SystemsDelight (Default)' },
  });

  const permissions = [
    ['tool.read','Read tool definitions'],
    ['tool.write','Edit draft tool definitions'],
    ['tool.publish','Publish tool versions'],
    ['visit.create','Create visits'],
    ['visit.edit_own','Edit own draft visits'],
    ['visit.submit','Submit visits'],
    ['analytics.view','View analytics'],
    ['export.download','Download exports'],
    ['users.manage','Manage users and roles'],
  ] as const;

  for (const [code,name] of permissions) {
    await prisma.permission.upsert({ where: { code }, update: { name }, create: { code, name } });
  }

  const roles = [
    ['SUPERADMIN','Super Admin'],
    ['ORGADMIN','Organization Admin'],
    ['TOOLADMIN','Tool Admin'],
    ['BUILDER','Builder'],
    ['SUPERVISOR','Supervisor'],
    ['VIEWER','Viewer/Analyst'],
  ] as const;

  const roleRecs = [];
  for (const [code,name] of roles) {
    roleRecs.push(await prisma.role.upsert({
      where: { orgId_code: { orgId: org.id, code } },
      update: { name },
      create: { orgId: org.id, code, name },
    }));
  }

  const perms = await prisma.permission.findMany();
  const permId = new Map(perms.map(p => [p.code, p.id]));
  const roleId = new Map(roleRecs.map(r => [r.code, r.id]));

  const rp: Record<string, string[]> = {
    SUPERADMIN: ['tool.read','tool.write','tool.publish','visit.create','visit.edit_own','visit.submit','analytics.view','export.download','users.manage'],
    ORGADMIN:   ['tool.read','tool.write','tool.publish','analytics.view','export.download','users.manage'],
    TOOLADMIN:  ['tool.read','tool.write','tool.publish','analytics.view','export.download'],
    BUILDER:    ['tool.read','tool.write'],
    SUPERVISOR: ['tool.read','visit.create','visit.edit_own','visit.submit'],
    VIEWER:     ['tool.read','analytics.view','export.download'],
  };

  for (const [r, list] of Object.entries(rp)) {
    for (const p of list) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: roleId.get(r)!, permissionId: permId.get(p)! } },
        update: {},
        create: { roleId: roleId.get(r)!, permissionId: permId.get(p)! },
      });
    }
  }

  console.log('Seed complete. Default org code SYSTEMSDELIGHT');
}

main().finally(async () => prisma.$disconnect());
