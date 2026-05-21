import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Role } from '../common/enums';
import { UserContext } from '../common/types/user-context.type';
import { TokenDenylistService } from './token-denylist.service';

export interface JwtPayload {
  sub: number;
  username: string;
  role: Role;
  jti: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly denylist: TokenDenylistService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET', 'dev-secret-change-me'),
    });
  }

  validate(payload: JwtPayload): UserContext {
    if (!payload.jti || this.denylist.has(payload.jti)) {
      throw new UnauthorizedException('Token has been revoked');
    }
    return {
      id: payload.sub,
      username: payload.username,
      role: payload.role,
      jti: payload.jti,
    };
  }
}
