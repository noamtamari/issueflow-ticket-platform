import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { AuditLogService } from '../audit-log/audit-log.service';
import {
  TicketPriority,
  TicketStatus,
  TicketType,
} from '../common/enums';
import { DependenciesService } from '../dependencies/dependencies.service';
import { Project } from '../projects/project.entity';
import { User } from '../users/user.entity';
import { Ticket } from './ticket.entity';
import { TicketsService } from './tickets.service';

describe('TicketsService', () => {
  let service: TicketsService;
  let manager: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    softRemove: jest.Mock;
    restore: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let queryBuilder: {
    leftJoin: jest.Mock;
    where: jest.Mock;
    select: jest.Mock;
    addSelect: jest.Mock;
    groupBy: jest.Mock;
    addGroupBy: jest.Mock;
    orderBy: jest.Mock;
    addOrderBy: jest.Mock;
    limit: jest.Mock;
    getRawOne: jest.Mock;
  };
  const ticketRepo = { find: jest.fn(), findOne: jest.fn() };
  const dataSource = { transaction: jest.fn() };
  const auditLog = { record: jest.fn() };
  const dependencies = { hasUnresolvedBlockers: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    dependencies.hasUnresolvedBlockers.mockResolvedValue(false);
    queryBuilder = {
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue(undefined),
    };
    manager = {
      findOne: jest.fn(),
      create: jest.fn((_, dto) => dto),
      save: jest.fn(async (e) => ({ id: 100, ...e })),
      softRemove: jest.fn(),
      restore: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    dataSource.transaction.mockImplementation(async (cb: any) => cb(manager));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketsService,
        { provide: getRepositoryToken(Ticket), useValue: ticketRepo },
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: AuditLogService, useValue: auditLog },
        { provide: DependenciesService, useValue: dependencies },
      ],
    }).compile();
    service = module.get(TicketsService);
  });

  const createDto = {
    title: 'T',
    description: 'd',
    priority: TicketPriority.HIGH,
    type: TicketType.BUG,
    projectId: 1,
  };

  describe('create', () => {
    it('creates ticket when project and assignee exist, writes CREATE audit log', async () => {
      manager.findOne
        .mockResolvedValueOnce({ id: 1 } as Project)
        .mockResolvedValueOnce({ id: 2 } as User);
      const saved = await service.create({ ...createDto, assigneeId: 2 }, 99);
      expect(saved.id).toBe(100);
      expect(auditLog.record).toHaveBeenCalledWith(manager, expect.objectContaining({
        action: 'CREATE',
        entityType: 'TICKET',
        entityId: 100,
      }));
    });

    it('throws NotFoundException when project missing', async () => {
      manager.findOne.mockResolvedValueOnce(null);
      await expect(service.create(createDto, 99)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws NotFoundException when assignee missing', async () => {
      manager.findOne
        .mockResolvedValueOnce({ id: 1 })
        .mockResolvedValueOnce(null);
      await expect(service.create({ ...createDto, assigneeId: 7 }, 99)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('defaults status to TODO when not provided', async () => {
      manager.findOne.mockResolvedValueOnce({ id: 1 });
      await service.create(createDto, 99);
      expect(manager.create).toHaveBeenCalledWith(
        Ticket,
        expect.objectContaining({ status: TicketStatus.TODO }),
      );
    });

    it('auto-assigns to least-loaded DEVELOPER when assigneeId omitted', async () => {
      manager.findOne.mockResolvedValueOnce({ id: 1 } as Project);
      queryBuilder.getRawOne.mockResolvedValueOnce({ userId: 42, workload: 0 });
      const saved = await service.create(createDto, 99);
      expect(manager.create).toHaveBeenCalledWith(
        Ticket,
        expect.objectContaining({ assigneeId: 42 }),
      );
      expect(saved).toBeDefined();
      expect(auditLog.record).toHaveBeenCalledWith(manager, expect.objectContaining({
        action: 'AUTO_ASSIGN',
        actor: 'SYSTEM',
        performedBy: null,
      }));
    });

    it('leaves assigneeId null when no DEVELOPER available', async () => {
      manager.findOne.mockResolvedValueOnce({ id: 1 });
      queryBuilder.getRawOne.mockResolvedValueOnce(undefined);
      await service.create(createDto, 99);
      expect(manager.create).toHaveBeenCalledWith(
        Ticket,
        expect.objectContaining({ assigneeId: null }),
      );
      const autoCalls = auditLog.record.mock.calls.filter(
        (c) => c[1].action === 'AUTO_ASSIGN',
      );
      expect(autoCalls).toHaveLength(0);
    });
  });

  describe('update', () => {
    const baseTicket = (overrides: Partial<Ticket> = {}): Ticket =>
      ({
        id: 1,
        title: 'T',
        description: 'd',
        status: TicketStatus.TODO,
        priority: TicketPriority.LOW,
        type: TicketType.BUG,
        projectId: 1,
        assigneeId: null,
        dueDate: null,
        isOverdue: false,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        project: {} as Project,
        assignee: null,
        ...overrides,
      }) as Ticket;

    it('rejects update on DONE ticket with BadRequestException', async () => {
      manager.findOne.mockResolvedValue(baseTicket({ status: TicketStatus.DONE }));
      await expect(
        service.update(1, { version: 1, title: 'New' }, 99),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects version mismatch with ConflictException', async () => {
      manager.findOne.mockResolvedValue(baseTicket({ version: 5 }));
      await expect(
        service.update(1, { version: 3, title: 'New' }, 99),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects backward status transition', async () => {
      manager.findOne.mockResolvedValue(
        baseTicket({ status: TicketStatus.IN_PROGRESS }),
      );
      await expect(
        service.update(1, { version: 1, status: TicketStatus.TODO }, 99),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('allows forward status transition', async () => {
      manager.findOne.mockResolvedValue(baseTicket());
      const result = await service.update(
        1,
        { version: 1, status: TicketStatus.IN_PROGRESS },
        99,
      );
      expect(result.status).toBe(TicketStatus.IN_PROGRESS);
    });

    it('blocks transition to DONE when unresolved blockers exist', async () => {
      manager.findOne.mockResolvedValue(baseTicket({ status: TicketStatus.IN_REVIEW }));
      dependencies.hasUnresolvedBlockers.mockResolvedValueOnce(true);
      await expect(
        service.update(1, { version: 1, status: TicketStatus.DONE }, 99),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('allows DONE when blockers are all resolved', async () => {
      manager.findOne.mockResolvedValue(baseTicket({ status: TicketStatus.IN_REVIEW }));
      dependencies.hasUnresolvedBlockers.mockResolvedValueOnce(false);
      const result = await service.update(
        1,
        { version: 1, status: TicketStatus.DONE },
        99,
      );
      expect(result.status).toBe(TicketStatus.DONE);
    });

    it('clears isOverdue when priority changes manually', async () => {
      manager.findOne.mockResolvedValue(baseTicket({ isOverdue: true }));
      const result = await service.update(
        1,
        { version: 1, priority: TicketPriority.HIGH },
        99,
      );
      expect(result.isOverdue).toBe(false);
      expect(result.priority).toBe(TicketPriority.HIGH);
    });

    it('does NOT clear isOverdue when priority is unchanged', async () => {
      manager.findOne.mockResolvedValue(
        baseTicket({ isOverdue: true, priority: TicketPriority.HIGH }),
      );
      const result = await service.update(
        1,
        { version: 1, priority: TicketPriority.HIGH, title: 'edited' },
        99,
      );
      expect(result.isOverdue).toBe(true);
    });

    it('throws NotFoundException when ticket missing', async () => {
      manager.findOne.mockResolvedValueOnce(null);
      await expect(
        service.update(1, { version: 1, title: 'New' }, 99),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('validates new assignee exists when provided', async () => {
      manager.findOne
        .mockResolvedValueOnce(baseTicket())
        .mockResolvedValueOnce(null);
      await expect(
        service.update(1, { version: 1, assigneeId: 99 }, 99),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('soft-removes and writes DELETE audit log', async () => {
      const ticket = { id: 1 };
      manager.findOne.mockResolvedValue(ticket);
      await service.remove(1, 99);
      expect(manager.softRemove).toHaveBeenCalledWith(ticket);
      expect(auditLog.record).toHaveBeenCalledWith(manager, expect.objectContaining({
        action: 'DELETE',
        entityType: 'TICKET',
      }));
    });
  });

  describe('restore', () => {
    it('restores and writes RESTORE audit log', async () => {
      manager.findOne.mockResolvedValueOnce({ id: 1, deletedAt: new Date() });
      manager.findOne.mockResolvedValueOnce({ id: 1, deletedAt: null });
      await service.restore(1, 99);
      expect(manager.restore).toHaveBeenCalledWith(Ticket, 1);
      expect(auditLog.record).toHaveBeenCalledWith(manager, expect.objectContaining({
        action: 'RESTORE',
        entityType: 'TICKET',
      }));
    });

    it('throws NotFoundException for non-deleted ticket', async () => {
      manager.findOne.mockResolvedValueOnce(null);
      await expect(service.restore(1, 99)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('exportToCsv', () => {
    it('renders header + one row per ticket', async () => {
      jest.spyOn(service, 'findAllByProject').mockResolvedValue([
        {
          id: 1,
          title: 'Fix, with comma',
          description: 'Has "quotes"',
          status: TicketStatus.TODO,
          priority: TicketPriority.HIGH,
          type: TicketType.BUG,
          projectId: 1,
          assigneeId: 7,
        } as Ticket,
      ]);
      const csv = await service.exportToCsv(1);
      expect(csv).toContain('id,title,description,status,priority,type,assigneeId');
      expect(csv).toContain('"Fix, with comma"');
      expect(csv).toContain('"Has ""quotes"""');
      expect(csv).toContain(',7\n');
    });
  });

  describe('importFromCsv', () => {
    it('collects per-row errors and reports a summary', async () => {
      jest.spyOn(service, 'create').mockImplementation(async (dto) => {
        if (dto.title === 'will-fail') throw new Error('boom');
        return { id: 1 } as Ticket;
      });
      const csv = Buffer.from(
        [
          'title,description,status,priority,type,assigneeId',
          'ok-row,desc,TODO,HIGH,BUG,',
          'will-fail,desc,TODO,HIGH,BUG,',
          ',no-title,TODO,HIGH,BUG,',
          'bad-enum,desc,WAITING,HIGH,BUG,',
        ].join('\n'),
        'utf-8',
      );
      const summary = await service.importFromCsv(1, csv, 99);
      expect(summary.created).toBe(1);
      expect(summary.failed).toBe(3);
      expect(summary.errors.map((e) => e.row)).toEqual([3, 4, 5]);
      expect(summary.errors[1].message).toMatch(/title is required/);
      expect(summary.errors[2].message).toMatch(/invalid status/);
    });

    it('throws BadRequestException for malformed CSV', async () => {
      const csv = Buffer.from('garbage\nrow_without_proper_columns');
      await expect(service.importFromCsv(1, csv, 99)).resolves.toBeDefined();
    });
  });
});
