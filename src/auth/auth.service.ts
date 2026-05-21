import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { UserContext } from '../common/types/user-context.type';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './jwt.strategy';
import { TokenDenylistService } from './token-denylist.service';

export interface LoginResult {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly denylist: TokenDenylistService,
  ) {}

  async login(dto: LoginDto): Promise<LoginResult> {
    const user = await this.usersService.findByUsername(dto.username);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const ok = await bcrypt.compare(dto.password, user.password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    const expiresIn = this.parseExpiresIn(
      this.config.get<string>('JWT_EXPIRES_IN', '3600s'),
    );
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      jti: randomUUID(),
    };
    const accessToken = this.jwtService.sign(payload, {
      expiresIn,
    });

    return { accessToken, tokenType: 'Bearer', expiresIn };
  }

  logout(jti: string): void {
    this.denylist.add(jti);
  }

  async me(ctx: UserContext): Promise<User> {
    return this.usersService.findOne(ctx.id);
  }

  private parseExpiresIn(raw: string): number {
    const match = /^(\d+)s$/.exec(raw);
    if (match) return Number(match[1]);
    const asNumber = Number(raw);
    if (!Number.isNaN(asNumber) && asNumber > 0) return asNumber;
    return 3600;
  }
}
