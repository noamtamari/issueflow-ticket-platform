import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import {
  AuditAction,
  AuditActor,
  AuditEntityType,
} from '../common/enums';
import { AuditLog } from './audit-log.entity';
import { AuditLogService } from './audit-log.service';

describe('AuditLogService', () => {
  let service: AuditLogService;
  const repoMock = {
    find: jest.fn(),
  };

  beforeEach(async () => {
    repoMock.find.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        { provide: getRepositoryToken(AuditLog), useValue: repoMock },
      ],
    }).compile();
    service = module.get(AuditLogService);
  });

  describe('record', () => {
    it('persists an audit entry via the provided EntityManager', async () => {
      const created = { id: 99 } as AuditLog;
      const manager = {
        create: jest.fn().mockReturnValue(created),
        save: jest.fn().mockResolvedValue(created),
      } as unknown as EntityManager;

      const dto = {
        action: AuditAction.CREATE,
        entityType: AuditEntityType.USER,
        entityId: 1,
        performedBy: 2,
        actor: AuditActor.USER,
      };
      const result = await service.record(manager, dto);

      expect(manager.create).toHaveBeenCalledWith(AuditLog, dto);
      expect(manager.save).toHaveBeenCalledWith(created);
      expect(result).toBe(created);
    });
  });

  describe('findAll', () => {
    it('filters by every provided query param and sorts by timestamp DESC', async () => {
      repoMock.find.mockResolvedValue([]);
      await service.findAll({
        entityType: AuditEntityType.TICKET,
        entityId: 5,
        action: AuditAction.UPDATE,
        actor: AuditActor.USER,
      });
      expect(repoMock.find).toHaveBeenCalledWith({
        where: {
          entityType: AuditEntityType.TICKET,
          entityId: 5,
          action: AuditAction.UPDATE,
          actor: AuditActor.USER,
        },
        order: { timestamp: 'DESC' },
      });
    });

    it('omits filters that are not provided', async () => {
      repoMock.find.mockResolvedValue([]);
      await service.findAll({});
      expect(repoMock.find).toHaveBeenCalledWith({
        where: {},
        order: { timestamp: 'DESC' },
      });
    });
  });
});
