import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { Role } from '../common/enums';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { TokenDenylistService } from './token-denylist.service';

describe('AuthService', () => {
  let service: AuthService;
  const usersService = { findByUsername: jest.fn(), findOne: jest.fn() };
  const jwtService = { sign: jest.fn() };
  const config = { get: jest.fn() };
  const denylist = new TokenDenylistService();

  beforeEach(async () => {
    jest.clearAllMocks();
    denylist.clear();
    config.get.mockImplementation((key: string, fallback?: unknown) => {
      if (key === 'JWT_EXPIRES_IN') return '3600s';
      return fallback;
    });
    jwtService.sign.mockReturnValue('signed-jwt');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: config },
        { provide: TokenDenylistService, useValue: denylist },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  describe('login', () => {
    it('returns access token with Bearer/expiresIn on valid credentials', async () => {
      const passwordHash = await bcrypt.hash('secret', 4);
      usersService.findByUsername.mockResolvedValue({
        id: 1,
        username: 'jdoe',
        role: Role.DEVELOPER,
        password: passwordHash,
      });

      const result = await service.login({ username: 'jdoe', password: 'secret' });

      expect(result.accessToken).toBe('signed-jwt');
      expect(result.tokenType).toBe('Bearer');
      expect(result.expiresIn).toBe(3600);
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 1, username: 'jdoe', role: Role.DEVELOPER, jti: expect.any(String) }),
        { expiresIn: 3600 },
      );
    });

    it('throws UnauthorizedException for unknown username', async () => {
      usersService.findByUsername.mockResolvedValue(null);
      await expect(
        service.login({ username: 'ghost', password: 'x' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('throws UnauthorizedException for wrong password', async () => {
      const passwordHash = await bcrypt.hash('correct', 4);
      usersService.findByUsername.mockResolvedValue({
        id: 1,
        username: 'jdoe',
        role: Role.DEVELOPER,
        password: passwordHash,
      });
      await expect(
        service.login({ username: 'jdoe', password: 'wrong' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('adds the JTI to the denylist', () => {
      service.logout('jti-abc');
      expect(denylist.has('jti-abc')).toBe(true);
    });
  });

  describe('me', () => {
    it('returns the profile of the current user', async () => {
      const user = { id: 42, username: 'jdoe' };
      usersService.findOne.mockResolvedValue(user);
      const result = await service.me({
        id: 42,
        username: 'jdoe',
        role: Role.DEVELOPER,
        jti: 'x',
      });
      expect(result).toBe(user);
      expect(usersService.findOne).toHaveBeenCalledWith(42);
    });
  });
});
