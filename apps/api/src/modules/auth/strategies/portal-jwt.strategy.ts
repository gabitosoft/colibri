import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { passportJwtSecret } from 'jwks-rsa';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { TenantsService } from '../../tenants/tenants.service';
import { UsersService } from '../../users/users.service';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { PortalJwtPayload } from '../interfaces/portal-jwt-payload.interface';

// Accepts RS256 tokens issued by the portal identity provider, verified
// against its JWKS endpoint — colibri never holds the portal's signing key.
//
// Identity mapping: portal and colibri keep separate user/tenant tables with
// different IDs, so portal claims are mapped to local records by natural keys:
// tenant via tenantSlug -> tenants.slug, then user via email + tenantId.
// The resulting request user carries colibri's own IDs and the user's LOCAL
// role (colibri stays authoritative for authorization; the portal role is
// ignored). Portal users with no matching colibri account are rejected.
@Injectable()
export class PortalJwtStrategy extends PassportStrategy(Strategy, 'portal-jwt') {
  constructor(
    config: ConfigService,
    private readonly tenantsService: TenantsService,
    private readonly usersService: UsersService,
  ) {
    // Prefer a statically-configured RS256 public key (PORTAL_JWT_PUBLIC_KEY) so
    // validation needs no network call to the portal JWKS endpoint. Fall back to
    // the JWKS endpoint only when the key isn't provided (e.g. local dev).
    const publicKey = config
      .get<string>('PORTAL_JWT_PUBLIC_KEY')
      ?.replace(/\\n/g, '\n');

    const keyOptions = publicKey
      ? { secretOrKey: publicKey }
      : {
          secretOrKeyProvider: passportJwtSecret({
            cache: true,
            rateLimit: true,
            jwksRequestsPerMinute: 10,
            jwksUri:
              config.get<string>('AUTH_JWKS_URL') ??
              'http://localhost:3001/.well-known/jwks.json',
          }),
        };

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: ['RS256'],
      issuer: config.get('AUTH_JWT_ISSUER', 'http://localhost:3001'),
      audience: 'portal',
      ...keyOptions,
    });
  }

  async validate(payload: PortalJwtPayload): Promise<JwtPayload> {
    const tenant = await this.tenantsService
      .findBySlug(payload.tenantSlug)
      .catch(() => null);
    if (!tenant || !tenant.isActive) {
      throw new UnauthorizedException('No matching tenant in colibri');
    }

    const user = await this.usersService.findByEmailAndTenant(
      payload.email,
      tenant.id,
    );
    if (!user || !user.isActive) {
      throw new UnauthorizedException('No matching colibri account');
    }

    return {
      sub: user.id,
      email: user.email,
      tenantId: tenant.id,
      role: user.role,
    };
  }
}
