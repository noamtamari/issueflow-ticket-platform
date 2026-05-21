import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, Not, Repository } from 'typeorm';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { AuditLogService } from '../audit-log/audit-log.service';
import {
  AuditAction,
  AuditActor,
  AuditEntityType,
  isForwardTransition,
  Role,
  TicketPriority,
  TicketStatus,
  TicketType,
} from '../common/enums';
import { DependenciesService } from '../dependencies/dependencies.service';
import { Project } from '../projects/project.entity';
import { User } from '../users/user.entity';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { ImportSummary } from './dto/import-tickets.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { Ticket } from './ticket.entity';

const EXPORT_COLUMNS = [
  'id',
  'title',
  'description',
  'status',
  'priority',
  'type',
  'assigneeId',
] as const;

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
    private readonly dependenciesService: DependenciesService,
  ) {}

  async create(dto: CreateTicketDto, performedBy: number): Promise<Ticket> {
    return this.dataSource.transaction(async (manager) => {
      await this.ensureProjectExists(manager, dto.projectId);

      let resolvedAssigneeId: number | null;
      let autoAssigned = false;
      if (dto.assigneeId !== undefined && dto.assigneeId !== null) {
        await this.ensureUserExists(manager, dto.assigneeId);
        resolvedAssigneeId = dto.assigneeId;
      } else {
        resolvedAssigneeId = await this.pickLeastLoadedDeveloper(
          manager,
          dto.projectId,
        );
        autoAssigned = resolvedAssigneeId !== null;
      }

      const ticket = manager.create(Ticket, {
        ...dto,
        status: dto.status ?? TicketStatus.TODO,
        assigneeId: resolvedAssigneeId,
        dueDate: dto.dueDate ?? null,
        isOverdue: false,
      });
      const saved = await manager.save(ticket);

      await this.auditLogService.record(manager, {
        action: AuditAction.CREATE,
        entityType: AuditEntityType.TICKET,
        entityId: saved.id,
        performedBy,
        actor: AuditActor.USER,
      });

      if (autoAssigned) {
        await this.auditLogService.record(manager, {
          action: AuditAction.AUTO_ASSIGN,
          entityType: AuditEntityType.TICKET,
          entityId: saved.id,
          performedBy: null,
          actor: AuditActor.SYSTEM,
        });
      }

      return saved;
    });
  }

  private async pickLeastLoadedDeveloper(
    manager: EntityManager,
    projectId: number,
  ): Promise<number | null> {
    const row = await manager
      .createQueryBuilder(User, 'u')
      .leftJoin(
        Ticket,
        't',
        't.assignee_id = u.id AND t.project_id = :projectId AND t.status != :done AND t.deleted_at IS NULL',
        { projectId, done: TicketStatus.DONE },
      )
      .where('u.role = :role', { role: Role.DEVELOPER })
      .select('u.id', 'userId')
      .addSelect('COUNT(t.id)::int', 'workload')
      .groupBy('u.id')
      .orderBy('"workload"', 'ASC')
      .addOrderBy('u.created_at', 'ASC')
      .addOrderBy('u.id', 'ASC')
      .limit(1)
      .getRawOne();
    return row ? Number(row.userId) : null;
  }

  findAllByProject(projectId: number): Promise<Ticket[]> {
    return this.ticketRepo.find({
      where: { projectId },
      order: { id: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Ticket> {
    const ticket = await this.ticketRepo.findOne({ where: { id } });
    if (!ticket) throw new NotFoundException(`Ticket ${id} not found`);
    return ticket;
  }

  async update(
    id: number,
    dto: UpdateTicketDto,
    performedBy: number,
  ): Promise<Ticket> {
    return this.dataSource.transaction(async (manager) => {
      const ticket = await manager.findOne(Ticket, { where: { id } });
      if (!ticket) throw new NotFoundException(`Ticket ${id} not found`);

      if (ticket.status === TicketStatus.DONE) {
        throw new BadRequestException('Cannot update a DONE ticket');
      }

      if (dto.version !== ticket.version) {
        throw new ConflictException(
          `Ticket version mismatch (expected ${ticket.version}, got ${dto.version})`,
        );
      }

      if (dto.status !== undefined && dto.status !== ticket.status) {
        if (!isForwardTransition(ticket.status, dto.status)) {
          throw new BadRequestException(
            `Status cannot move from ${ticket.status} to ${dto.status}`,
          );
        }
        if (dto.status === TicketStatus.DONE) {
          const blocked = await this.dependenciesService.hasUnresolvedBlockers(
            manager,
            ticket.id,
          );
          if (blocked) {
            throw new BadRequestException(
              'Cannot transition to DONE while unresolved blockers exist',
            );
          }
        }
        ticket.status = dto.status;
      }

      if (dto.assigneeId !== undefined && dto.assigneeId !== null) {
        await this.ensureUserExists(manager, dto.assigneeId);
      }

      if (dto.title !== undefined) ticket.title = dto.title;
      if (dto.description !== undefined) ticket.description = dto.description;
      if (dto.assigneeId !== undefined) ticket.assigneeId = dto.assigneeId;
      if (dto.dueDate !== undefined) ticket.dueDate = dto.dueDate;

      if (dto.priority !== undefined && dto.priority !== ticket.priority) {
        ticket.priority = dto.priority;
        ticket.isOverdue = false;
      }

      const saved = await manager.save(ticket);

      await this.auditLogService.record(manager, {
        action: AuditAction.UPDATE,
        entityType: AuditEntityType.TICKET,
        entityId: saved.id,
        performedBy,
        actor: AuditActor.USER,
      });

      return saved;
    });
  }

  async remove(id: number, performedBy: number): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const ticket = await manager.findOne(Ticket, { where: { id } });
      if (!ticket) throw new NotFoundException(`Ticket ${id} not found`);

      await manager.softRemove(ticket);

      await this.auditLogService.record(manager, {
        action: AuditAction.DELETE,
        entityType: AuditEntityType.TICKET,
        entityId: id,
        performedBy,
        actor: AuditActor.USER,
      });
    });
  }

  findDeleted(projectId: number): Promise<Ticket[]> {
    return this.ticketRepo.find({
      where: { projectId, deletedAt: Not(IsNull()) },
      withDeleted: true,
      order: { id: 'ASC' },
    });
  }

  async restore(id: number, performedBy: number): Promise<Ticket> {
    return this.dataSource.transaction(async (manager) => {
      const ticket = await manager.findOne(Ticket, {
        where: { id, deletedAt: Not(IsNull()) },
        withDeleted: true,
      });
      if (!ticket) throw new NotFoundException(`Deleted ticket ${id} not found`);

      await manager.restore(Ticket, id);

      await this.auditLogService.record(manager, {
        action: AuditAction.RESTORE,
        entityType: AuditEntityType.TICKET,
        entityId: id,
        performedBy,
        actor: AuditActor.USER,
      });

      const restored = await manager.findOne(Ticket, { where: { id } });
      return restored as Ticket;
    });
  }

  async exportToCsv(projectId: number): Promise<string> {
    const tickets = await this.findAllByProject(projectId);
    const rows = tickets.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      type: t.type,
      assigneeId: t.assigneeId ?? '',
    }));
    return stringify(rows, { header: true, columns: [...EXPORT_COLUMNS] });
  }

  async importFromCsv(
    projectId: number,
    csv: Buffer,
    performedBy: number,
  ): Promise<ImportSummary> {
    let rows: Record<string, string>[];
    try {
      rows = parse(csv.toString('utf8'), {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }) as Record<string, string>[];
    } catch (err: unknown) {
      throw new BadRequestException(
        `Invalid CSV: ${(err as Error).message}`,
      );
    }

    const errors: ImportSummary['errors'] = [];
    let created = 0;

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2; // +1 for header, +1 for 1-indexed
      try {
        const dto = this.csvRowToDto(rows[i], projectId);
        await this.create(dto, performedBy);
        created++;
      } catch (err: unknown) {
        errors.push({
          row: rowNumber,
          message: (err as Error).message,
        });
      }
    }

    return { created, failed: errors.length, errors };
  }

  private csvRowToDto(
    row: Record<string, string>,
    projectId: number,
  ): CreateTicketDto {
    const title = row.title?.trim();
    if (!title) throw new Error('title is required');

    const status = (row.status?.trim() || TicketStatus.TODO) as TicketStatus;
    if (!Object.values(TicketStatus).includes(status)) {
      throw new Error(`invalid status: ${row.status}`);
    }

    const priority = row.priority?.trim() as TicketPriority;
    if (!Object.values(TicketPriority).includes(priority)) {
      throw new Error(`invalid priority: ${row.priority}`);
    }

    const type = row.type?.trim() as TicketType;
    if (!Object.values(TicketType).includes(type)) {
      throw new Error(`invalid type: ${row.type}`);
    }

    const assigneeRaw = row.assigneeId?.trim();
    let assigneeId: number | undefined;
    if (assigneeRaw) {
      const parsed = Number(assigneeRaw);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(`invalid assigneeId: ${assigneeRaw}`);
      }
      assigneeId = parsed;
    }

    return {
      title,
      description: row.description ?? '',
      status,
      priority,
      type,
      projectId,
      assigneeId,
    };
  }

  private async ensureProjectExists(
    manager: EntityManager,
    projectId: number,
  ): Promise<void> {
    const project = await manager.findOne(Project, { where: { id: projectId } });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
  }

  private async ensureUserExists(
    manager: EntityManager,
    userId: number,
  ): Promise<void> {
    const user = await manager.findOne(User, { where: { id: userId } });
    if (!user) throw new NotFoundException(`User ${userId} not found`);
  }
}
