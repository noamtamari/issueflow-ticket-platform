import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { AuditLogService } from '../audit-log/audit-log.service';
import { Project } from './project.entity';
import { ProjectsService } from './projects.service';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let manager: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    softRemove: jest.Mock;
    restore: jest.Mock;
  };
  const projectRepo = { find: jest.fn(), findOne: jest.fn() };
  const dataSource = { transaction: jest.fn() };
  const auditLog = { record: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    manager = {
      findOne: jest.fn(),
      create: jest.fn((_, dto) => dto),
      save: jest.fn(async (e) => ({ id: 10, ...e })),
      softRemove: jest.fn(),
      restore: jest.fn(),
    };
    dataSource.transaction.mockImplementation(async (cb: any) => cb(manager));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: getRepositoryToken(Project), useValue: projectRepo },
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile();
    service = module.get(ProjectsService);
  });

  describe('create', () => {
    it('creates project when owner exists and writes CREATE audit log', async () => {
      manager.findOne.mockResolvedValueOnce({ id: 5 });
      const saved = await service.create(
        { name: 'P', description: 'd', ownerId: 5 },
        99,
      );
      expect(saved.id).toBe(10);
      expect(auditLog.record).toHaveBeenCalledWith(manager, expect.objectContaining({
        action: 'CREATE',
        entityType: 'PROJECT',
        entityId: 10,
        performedBy: 99,
      }));
    });

    it('throws NotFoundException when owner missing', async () => {
      manager.findOne.mockResolvedValueOnce(null);
      await expect(
        service.create({ name: 'P', description: 'd', ownerId: 5 }, 99),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when missing', async () => {
      projectRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne(1)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates fields and writes UPDATE audit log', async () => {
      manager.findOne.mockResolvedValueOnce({ id: 1, name: 'Old', description: 'Old' });
      const result = await service.update(1, { name: 'New' }, 99);
      expect(result.name).toBe('New');
      expect(auditLog.record).toHaveBeenCalledWith(manager, expect.objectContaining({
        action: 'UPDATE',
        entityType: 'PROJECT',
      }));
    });

    it('throws NotFoundException when project missing', async () => {
      manager.findOne.mockResolvedValueOnce(null);
      await expect(service.update(1, { name: 'X' }, 99)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('soft-removes and writes DELETE audit log', async () => {
      const project = { id: 1 };
      manager.findOne.mockResolvedValueOnce(project);
      await service.remove(1, 99);
      expect(manager.softRemove).toHaveBeenCalledWith(project);
      expect(auditLog.record).toHaveBeenCalledWith(manager, expect.objectContaining({
        action: 'DELETE',
        entityType: 'PROJECT',
        entityId: 1,
      }));
    });
  });

  describe('restore', () => {
    it('restores and writes RESTORE audit log', async () => {
      manager.findOne.mockResolvedValueOnce({ id: 1, deletedAt: new Date() });
      manager.findOne.mockResolvedValueOnce({ id: 1, deletedAt: null });
      await service.restore(1, 99);
      expect(manager.restore).toHaveBeenCalledWith(Project, 1);
      expect(auditLog.record).toHaveBeenCalledWith(manager, expect.objectContaining({
        action: 'RESTORE',
        entityType: 'PROJECT',
      }));
    });

    it('throws NotFoundException for an undeleted/missing project', async () => {
      manager.findOne.mockResolvedValueOnce(null);
      await expect(service.restore(1, 99)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
