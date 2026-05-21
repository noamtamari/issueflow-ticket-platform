import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { CronJob } from 'cron';
import { DataSource, IsNull, LessThan, Not } from 'typeorm';
import { AuditLogService } from '../audit-log/audit-log.service';
import {
  AuditAction,
  AuditActor,
  AuditEntityType,
  nextPriority,
  TicketPriority,
  TicketStatus,
} from '../common/enums';
import { Ticket } from '../tickets/ticket.entity';

@Injectable()
export class EscalationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EscalationService.name);
  private job?: CronJob;

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
    private readonly schedulerRegistry: SchedulerRegistry,
    @Inject(ConfigService)
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    if (this.config.get<string>('ESCALATION_DISABLED') === 'true') return;
    const cron = this.config.get<string>('ESCALATION_CRON', '*/1 * * * *');
    this.job = new CronJob(cron, () => {
      this.runEscalationCycle().catch((err) =>
        this.logger.error('Escalation cycle failed', err as Error),
      );
    });
    this.schedulerRegistry.addCronJob('ticket-escalation', this.job);
    this.job.start();
  }

  onModuleDestroy(): void {
    this.job?.stop();
  }

  async runEscalationCycle(now: Date = new Date()): Promise<number> {
    const candidates = await this.dataSource.getRepository(Ticket).find({
      where: {
        status: Not(TicketStatus.DONE),
        dueDate: LessThan(now),
        deletedAt: IsNull(),
      },
    });

    let processed = 0;
    for (const ticket of candidates) {
      await this.escalateOne(ticket.id);
      processed++;
    }
    if (processed > 0) {
      this.logger.log(`Escalation cycle processed ${processed} tickets`);
    }
    return processed;
  }

  private async escalateOne(ticketId: number): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const ticket = await manager.findOne(Ticket, { where: { id: ticketId } });
      if (!ticket) return;
      if (ticket.status === TicketStatus.DONE) return;
      if (!ticket.dueDate || ticket.dueDate >= new Date()) return;

      if (ticket.priority !== TicketPriority.CRITICAL) {
        const promoted = nextPriority(ticket.priority);
        if (!promoted) return;
        ticket.priority = promoted;
      } else if (!ticket.isOverdue) {
        ticket.isOverdue = true;
      } else {
        return; // already CRITICAL and overdue — idempotent skip
      }

      await manager.save(ticket);
      await this.auditLogService.record(manager, {
        action: AuditAction.ESCALATE,
        entityType: AuditEntityType.TICKET,
        entityId: ticket.id,
        performedBy: null,
        actor: AuditActor.SYSTEM,
      });
    });
  }
}
