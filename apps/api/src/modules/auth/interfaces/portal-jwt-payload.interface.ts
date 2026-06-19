// Access-token payload issued by the portal identity provider
// (see portal/packages/shared/src/jwt.ts)
export interface PortalJwtPayload {
  sub: string;
  email: string;
  name: string;
  tenantId: string;
  tenantSlug: string;
  role: string;
}
