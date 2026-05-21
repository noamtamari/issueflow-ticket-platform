import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { AuditLogService } from '../audit-log/audit-log.service';
import {
  AuditAction,
  AuditActor,
  AuditEntityType,
  TicketStatus,
} from '../common/enums';
import { Ticket } from '../tickets/ticket.entity';
import { TicketDependency } from './ticket-dependency.entity';

@Injectable()
export class DependenciesService {
  constructor(
    @InjectRepository(TicketDependency)
    private readonly depRepo: Repository<TicketDependency>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
  ) {}

  async add(
    ticketId: number,
    blockerId: number,
    performedBy: number,
  ): Promise<TicketDependency> {
    if (ticketId === blockerId) {
      throw new BadRequestException('A ticket cannot block itself');
    }

    return this.dataSource.transaction(async (manager) => {
      const [ticket, blocker] = await Promise.all([
        manager.findOne(Ticket, { where: { id: ticketId } }),
        manager.findOne(Ticket, { where: { id: blockerId } }),
      ]);
      if (!ticket) throw new NotFoundException(`Ticket ${ticketId} not found`);
      if (!blocker) throw new NotFoundException(`Blocker ticket ${blockerId} not found`);
      if (ticket.projectId !== blocker.projectId) {
        throw new BadRequestException(
          'Blocker must belong to the same project as the ticket',
        );
      }

      const exists = await manager.findOne(TicketDependency, {
        where: { ticketId, blockerId },
      });
      if (exists) {
        throw new ConflictException('Dependency already exists');
      }

      const dep = manager.create(TicketDependency, { ticketId, blockerId });
      const saved = await manager.save(dep);

      await this.auditLogService.record(manager, {
        action: AuditAction.ADD_DEPENDENCY,
        entityType: AuditEntityType.TICKET,
        entityId: ticketId,
        performedBy,
        actor: AuditActor.USER,
      });

      return saved;
    });
  }

  async listBlockers(ticketId: number): Promise<Ticket[]> {
    const deps = await this.depRepo.find({
      where: { ticketId },
      relations: ['blocker'],
      order: { id: 'ASC' },
    });
    return deps.map((d) => d.blocker);
  }

  async remove(
    ticketId: number,
    blockerId: number,
    performedBy: number,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const dep = await manager.findOne(TicketDependency, {
        where: { ticketId, blockerId },
      });
      if (!dep) {
        throw new NotFoundException(
          `No dependency between ticket ${ticketId} and blocker ${blockerId}`,
        );
      }

      await manager.remove(dep);

      await this.auditLogService.record(manager, {
        action: AuditAction.REMOVE_DEPENDENCY,
        entityType: AuditEntityType.TICKET,
        entityId: ticketId,
        performedBy,
        actor: AuditActor.USER,
      });
    });
  }

  async hasUnresolvedBlockers(
    manager: EntityManager,
    ticketId: number,
  ): Promise<boolean> {
    const count = await manager
      .createQueryBuilder(TicketDependency, 'd')
      .innerJoin(Ticket, 't', 't.id = d.blocker_id')
      .where('d.ticket_id = :ticketId', { ticketId })
      .andWhere('t.status != :done', { done: TicketStatus.DONE })
      .andWhere('t.deleted_at IS NULL')
      .getCount();
    return count > 0;
  }
}
