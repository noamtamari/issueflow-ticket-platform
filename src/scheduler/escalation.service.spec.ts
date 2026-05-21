import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { AuditLogService } from '../audit-log/audit-log.service';
import {
  TicketPriority,
  TicketStatus,
} from '../common/enums';
import { Ticket } from '../tickets/ticket.entity';
import { EscalationService } from './escalation.service';

describe('EscalationService', () => {
  let service: EscalationService;
  let manager: { findOne: jest.Mock; save: jest.Mock };
  const auditLog = { record: jest.fn() };
  const repo = { find: jest.fn() };
  const dataSource = {
    transaction: jest.fn(),
    getRepository: jest.fn().mockReturnValue(repo),
  };
  const config = {
    get: jest.fn().mockReturnValue('*/1 * * * *'),
  };
  const schedulerRegistry = { addCronJob: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    manager = {
      findOne: jest.fn(),
      save: jest.fn(async (t) => t),
    };
    dataSource.transaction.mockImplementation(async (cb: any) => cb(manager));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscalationService,
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: AuditLogService, useValue: auditLog },
        { provide: SchedulerRegistry, useValue: schedulerRegistry },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    service = module.get(EscalationService);
  });

  const ticket = (overrides: Partial<Ticket> = {}): Ticket =>
    ({
      id: 1,
      status: TicketStatus.TODO,
      priority: TicketPriority.LOW,
      dueDate: new Date(Date.now() - 60_000),
      isOverdue: false,
      ...overrides,
    }) as Ticket;

  it('promotes LOW → MEDIUM and records ESCALATE audit', async () => {
    const t = ticket({ priority: TicketPriority.LOW });
    repo.find.mockResolvedValue([t]);
    manager.findOne.mockResolvedValue(t);

    const count = await service.runEscalationCycle();

    expect(count).toBe(1);
    expect(t.priority).toBe(TicketPriority.MEDIUM);
    expect(manager.save).toHaveBeenCalledWith(t);
    expect(auditLog.record).toHaveBeenCalledWith(manager, expect.objectContaining({
      action: 'ESCALATE',
      actor: 'SYSTEM',
      performedBy: null,
    }));
  });

  it('CRITICAL + not overdue → set isOverdue=true, do not bump priority', async () => {
    const t = ticket({ priority: TicketPriority.CRITICAL, isOverdue: false });
    repo.find.mockResolvedValue([t]);
    manager.findOne.mockResolvedValue(t);

    await service.runEscalationCycle();

    expect(t.priority).toBe(TicketPriority.CRITICAL);
    expect(t.isOverdue).toBe(true);
    expect(manager.save).toHaveBeenCalled();
  });

  it('CRITICAL + already overdue → idempotent skip (no save)', async () => {
    const t = ticket({ priority: TicketPriority.CRITICAL, isOverdue: true });
    repo.find.mockResolvedValue([t]);
    manager.findOne.mockResolvedValue(t);

    await service.runEscalationCycle();

    expect(manager.save).not.toHaveBeenCalled();
    expect(auditLog.record).not.toHaveBeenCalled();
  });

  it('skips tickets that are no longer overdue at escalation time', async () => {
    const stillOverdueAtQuery = ticket();
    repo.find.mockResolvedValue([stillOverdueAtQuery]);
    manager.findOne.mockResolvedValue(
      ticket({ dueDate: new Date(Date.now() + 60_000) }),
    );

    await service.runEscalationCycle();
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('skips DONE tickets that slip through the query', async () => {
    repo.find.mockResolvedValue([ticket()]);
    manager.findOne.mockResolvedValue(
      ticket({ status: TicketStatus.DONE }),
    );

    await service.runEscalationCycle();
    expect(manager.save).not.toHaveBeenCalled();
  });
});
