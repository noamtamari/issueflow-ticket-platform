import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { AuditLogService } from '../audit-log/audit-log.service';
import { Ticket } from '../tickets/ticket.entity';
import { DependenciesService } from './dependencies.service';
import { TicketDependency } from './ticket-dependency.entity';

describe('DependenciesService', () => {
  let service: DependenciesService;
  let manager: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let countQb: {
    innerJoin: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    getCount: jest.Mock;
  };
  const depRepo = { find: jest.fn() };
  const dataSource = { transaction: jest.fn() };
  const auditLog = { record: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    countQb = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn(),
    };
    manager = {
      findOne: jest.fn(),
      create: jest.fn((_, dto) => dto),
      save: jest.fn(async (e) => ({ id: 400, ...e })),
      remove: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(countQb),
    };
    dataSource.transaction.mockImplementation(async (cb: any) => cb(manager));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DependenciesService,
        { provide: getRepositoryToken(TicketDependency), useValue: depRepo },
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile();
    service = module.get(DependenciesService);
  });

  describe('add', () => {
    it('rejects self-dependency with BadRequestException', async () => {
      await expect(service.add(1, 1, 99)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when ticket missing', async () => {
      manager.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 2, projectId: 1 });
      await expect(service.add(1, 2, 99)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws NotFoundException when blocker missing', async () => {
      manager.findOne
        .mockResolvedValueOnce({ id: 1, projectId: 1 })
        .mockResolvedValueOnce(null);
      await expect(service.add(1, 2, 99)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('rejects cross-project dependency with BadRequestException', async () => {
      manager.findOne
        .mockResolvedValueOnce({ id: 1, projectId: 1 } as Ticket)
        .mockResolvedValueOnce({ id: 2, projectId: 9 } as Ticket);
      await expect(service.add(1, 2, 99)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects duplicate dependency with ConflictException', async () => {
      manager.findOne
        .mockResolvedValueOnce({ id: 1, projectId: 1 } as Ticket)
        .mockResolvedValueOnce({ id: 2, projectId: 1 } as Ticket)
        .mockResolvedValueOnce({ id: 99, ticketId: 1, blockerId: 2 });
      await expect(service.add(1, 2, 99)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('persists dependency and writes ADD_DEPENDENCY audit log', async () => {
      manager.findOne
        .mockResolvedValueOnce({ id: 1, projectId: 1 } as Ticket)
        .mockResolvedValueOnce({ id: 2, projectId: 1 } as Ticket)
        .mockResolvedValueOnce(null);
      const saved = await service.add(1, 2, 99);
      expect(saved.id).toBe(400);
      expect(manager.create).toHaveBeenCalledWith(
        TicketDependency,
        expect.objectContaining({ ticketId: 1, blockerId: 2 }),
      );
      expect(auditLog.record).toHaveBeenCalledWith(
        manager,
        expect.objectContaining({
          action: 'ADD_DEPENDENCY',
          entityType: 'TICKET',
          entityId: 1,
          performedBy: 99,
        }),
      );
    });
  });

  describe('listBlockers', () => {
    it('returns blocker tickets attached to dependency rows', async () => {
      depRepo.find.mockResolvedValue([
        { id: 1, blocker: { id: 2, title: 'Blocker A' } },
        { id: 2, blocker: { id: 3, title: 'Blocker B' } },
      ]);
      const result = await service.listBlockers(7);
      expect(result.map((t) => t.id)).toEqual([2, 3]);
    });
  });

  describe('remove', () => {
    it('removes the row and writes REMOVE_DEPENDENCY audit log', async () => {
      const dep = { id: 1, ticketId: 1, blockerId: 2 };
      manager.findOne.mockResolvedValueOnce(dep);
      await service.remove(1, 2, 99);
      expect(manager.remove).toHaveBeenCalledWith(dep);
      expect(auditLog.record).toHaveBeenCalledWith(
        manager,
        expect.objectContaining({
          action: 'REMOVE_DEPENDENCY',
          entityType: 'TICKET',
          entityId: 1,
        }),
      );
    });

    it('throws NotFoundException when dependency missing', async () => {
      manager.findOne.mockResolvedValueOnce(null);
      await expect(service.remove(1, 2, 99)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('hasUnresolvedBlockers', () => {
    it('returns true when at least one non-DONE blocker exists', async () => {
      countQb.getCount.mockResolvedValue(2);
      await expect(
        service.hasUnresolvedBlockers(manager as never, 5),
      ).resolves.toBe(true);
    });

    it('returns false when no blockers are pending', async () => {
      countQb.getCount.mockResolvedValue(0);
      await expect(
        service.hasUnresolvedBlockers(manager as never, 5),
      ).resolves.toBe(false);
    });
  });
});
