import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Accepts colibri's own HS256 tokens or portal-issued RS256 tokens;
// passport tries each strategy in order until one succeeds
@Injectable()
export class JwtAuthGuard extends AuthGuard(['jwt', 'portal-jwt']) {}
