import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;

  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {
    this.googleClient = new OAuth2Client(process.env.GOOGLE_OIDC_CLIENT_ID);
  }

  async loginWithGoogleIdToken(idToken: string) {
    const clientId = process.env.GOOGLE_OIDC_CLIENT_ID;
    if (!clientId) throw new UnauthorizedException('GOOGLE_OIDC_CLIENT_ID not configured');

    const ticket = await this.googleClient.verifyIdToken({ idToken, audience: clientId });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email) throw new UnauthorizedException('Invalid Google token payload');

    // Invite-only: user must already exist
    const user = await this.prisma.user.findUnique({ where: { email: payload.email } });
    if (!user) throw new UnauthorizedException('User not invited. Add email in users table (or build invite UI).');
    if (user.status !== 'active') throw new UnauthorizedException('User inactive');

    await this.prisma.userIdentity.upsert({
      where: { provider_providerSub: { provider: 'google', providerSub: payload.sub } },
      update: { providerEmail: payload.email },
      create: { userId: user.id, provider: 'google', providerSub: payload.sub, providerEmail: payload.email },
    });

    const token = this.jwt.sign({ userId: String(user.id), email: user.email });
    return { jwt: token, user: { id: String(user.id), email: user.email, fullName: user.fullName } };
  }

  async me(userId: string) {
    const uid = BigInt(userId);
    const user = await this.prisma.user.findUnique({
      where: { id: uid },
      include: { memberships: { include: { org: true } }, roleAssignments: { include: { role: true, tool: true } } },
    });
    if (!user) throw new UnauthorizedException('User not found');

    return {
      user: { id: String(user.id), email: user.email, fullName: user.fullName },
      memberships: user.memberships.map(m => ({ orgId: String(m.orgId), orgCode: m.org.code, orgName: m.org.name, status: m.status })),
      roles: user.roleAssignments.map(ra => ({
        orgId: String(ra.orgId),
        role: ra.role.code,
        toolId: ra.toolId ? String(ra.toolId) : null,
        toolCode: ra.toolId ? (ra.tool as any)?.code : null,
        scope: ra.scopeJson ?? null,
      })),
    };
  }
}
