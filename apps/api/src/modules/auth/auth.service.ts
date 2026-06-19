import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly tenantsService: TenantsService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) { }

  async login(dto: LoginDto) {
    const tenant = await this.tenantsService.findBySlug(dto.tenantSlug);
    if (!tenant) throw new UnauthorizedException('Invalid credentials');

    const user = await this.usersService.findByEmailAndTenant(dto.email, tenant.id);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    if (!user.isActive) throw new UnauthorizedException('Account is inactive');

    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      tenantId: user.tenantId,
      tenantSlug: tenant.slug,
      role: user.role,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name },
    };
  }

  // SSO handoff from the portal: redeem the one-time ticket server-to-server,
  // map the portal identity to a local account (email + tenant slug — IDs
  // differ between systems), and issue a regular colibri session token so the
  // rest of the app works exactly as after a password login.
  async ssoExchange(ticket: string) {
    const authBaseUrl = this.config
      .get<string>('AUTH_BASE_URL', 'http://localhost:3001')
      .replace(/\/$/, '');

    let res: Response;
    try {
      res = await fetch(`${authBaseUrl}/auth/sso/exchange`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket }),
      });
    } catch {
      throw new UnauthorizedException('SSO provider is unreachable');
    }
    if (!res.ok) throw new UnauthorizedException('Invalid or expired ticket');

    const data = (await res.json()) as {
      user: { email: string };
      tenant: { slug: string };
    };

    const tenant = await this.tenantsService
      .findBySlug(data.tenant.slug)
      .catch(() => null);
    if (!tenant || !tenant.isActive) {
      throw new UnauthorizedException('No matching tenant in colibri');
    }

    const user = await this.usersService.findByEmailAndTenant(
      data.user.email,
      tenant.id,
    );
    if (!user || !user.isActive) {
      throw new UnauthorizedException('No matching colibri account');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      tenantId: user.tenantId,
      tenantSlug: tenant.slug,
      role: user.role,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name },
    };
  }
}
