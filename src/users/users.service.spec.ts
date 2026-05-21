import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { AuditLogService } from '../audit-log/audit-log.service';
import { Role } from '../common/enums';
import { User } from './user.entity';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let queryBuilder: { where: jest.Mock; getOne: jest.Mock };
  let manager: { create: jest.Mock; save: jest.Mock; findOne: jest.Mock; remove: jest.Mock };
  const userRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const dataSource = {
    transaction: jest.fn(),
  };
  const auditLog = {
    record: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    queryBuilder = { where: jest.fn().mockReturnThis(), getOne: jest.fn() };
    userRepo.createQueryBuilder.mockReturnValue(queryBuilder);
    manager = {
      create: jest.fn((_, dto) => dto),
      save: jest.fn(async (e) => ({ id: 7, ...e })),
      findOne: jest.fn(),
      remove: jest.fn(),
    };
    dataSource.transaction.mockImplementation(async (cb: any) => cb(manager));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile();
    service = module.get(UsersService);
  });

  describe('create', () => {
    it('hashes password, saves user, and writes a CREATE audit log', async () => {
      queryBuilder.getOne.mockResolvedValue(null);
      const dto = {
        username: 'jdoe',
        email: 'j@x.com',
        fullName: 'John',
        role: Role.DEVELOPER,
        password: 'secret123',
      };
      const created = await service.create(dto);

      expect(created.id).toBe(7);
      expect(created.password).not.toBe('secret123');
      expect(await bcrypt.compare('secret123', created.password)).toBe(true);
      expect(auditLog.record).toHaveBeenCalledWith(manager, expect.objectContaining({
        action: 'CREATE',
        entityType: 'USER',
        entityId: 7,
        performedBy: 7,
        actor: 'USER',
      }));
    });

    it('rejects when username already exists', async () => {
      queryBuilder.getOne.mockResolvedValue({ username: 'jdoe', email: 'other@x.com' });
      await expect(
        service.create({
          username: 'jdoe',
          email: 'j@x.com',
          fullName: 'John',
          role: Role.DEVELOPER,
          password: 'secret123',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects when email already exists', async () => {
      queryBuilder.getOne.mockResolvedValue({ username: 'other', email: 'j@x.com' });
      await expect(
        service.create({
          username: 'jdoe',
          email: 'j@x.com',
          fullName: 'John',
          role: Role.DEVELOPER,
          password: 'secret123',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when missing', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne(42)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns user when found', async () => {
      const user = { id: 1, username: 'jdoe' };
      userRepo.findOne.mockResolvedValue(user);
      await expect(service.findOne(1)).resolves.toBe(user);
    });
  });

  describe('update', () => {
    it('updates allowed fields and writes UPDATE audit log', async () => {
      manager.findOne.mockResolvedValue({ id: 1, fullName: 'Old', role: Role.DEVELOPER });
      const result = await service.update(1, { fullName: 'New', role: Role.ADMIN }, 99);
      expect(result.fullName).toBe('New');
      expect(result.role).toBe(Role.ADMIN);
      expect(auditLog.record).toHaveBeenCalledWith(manager, expect.objectContaining({
        action: 'UPDATE',
        entityType: 'USER',
        entityId: 1,
        performedBy: 99,
      }));
    });

    it('throws NotFoundException when user is missing', async () => {
      manager.findOne.mockResolvedValue(null);
      await expect(service.update(1, { fullName: 'New' }, 99)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('deletes user and writes DELETE audit log', async () => {
      const user = { id: 1 };
      manager.findOne.mockResolvedValue(user);
      await service.remove(1, 99);
      expect(manager.remove).toHaveBeenCalledWith(user);
      expect(auditLog.record).toHaveBeenCalledWith(manager, expect.objectContaining({
        action: 'DELETE',
        entityType: 'USER',
        entityId: 1,
        performedBy: 99,
      }));
    });

    it('throws NotFoundException when user is missing', async () => {
      manager.findOne.mockResolvedValue(null);
      await expect(service.remove(1, 99)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
