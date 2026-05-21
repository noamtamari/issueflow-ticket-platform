import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Not, Repository } from 'typeorm';
import { AuditLogService } from '../audit-log/audit-log.service';
import {
  AuditAction,
  AuditActor,
  AuditEntityType,
  Role,
  TicketStatus,
} from '../common/enums';
import { Ticket } from '../tickets/ticket.entity';
import { User } from '../users/user.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { Project } from './project.entity';

export interface WorkloadEntry {
  userId: number;
  username: string;
  openTicketCount: number;
}

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
  ) {}

  async create(dto: CreateProjectDto, performedBy: number): Promise<Project> {
    return this.dataSource.transaction(async (manager) => {
      const owner = await manager.findOne(User, { where: { id: dto.ownerId } });
      if (!owner) throw new NotFoundException(`Owner ${dto.ownerId} not found`);

      const project = manager.create(Project, dto);
      const saved = await manager.save(project);

      await this.auditLogService.record(manager, {
        action: AuditAction.CREATE,
        entityType: AuditEntityType.PROJECT,
        entityId: saved.id,
        performedBy,
        actor: AuditActor.USER,
      });

      return saved;
    });
  }

  findAll(): Promise<Project[]> {
    return this.projectRepo.find({ order: { id: 'ASC' } });
  }

  async findOne(id: number): Promise<Project> {
    const project = await this.projectRepo.findOne({ where: { id } });
    if (!project) throw new NotFoundException(`Project ${id} not found`);
    return project;
  }

  async update(
    id: number,
    dto: UpdateProjectDto,
    performedBy: number,
  ): Promise<Project> {
    return this.dataSource.transaction(async (manager) => {
      const project = await manager.findOne(Project, { where: { id } });
      if (!project) throw new NotFoundException(`Project ${id} not found`);

      if (dto.name !== undefined) project.name = dto.name;
      if (dto.description !== undefined) project.description = dto.description;
      const saved = await manager.save(project);

      await this.auditLogService.record(manager, {
        action: AuditAction.UPDATE,
        entityType: AuditEntityType.PROJECT,
        entityId: saved.id,
        performedBy,
        actor: AuditActor.USER,
      });

      return saved;
    });
  }

  async remove(id: number, performedBy: number): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const project = await manager.findOne(Project, { where: { id } });
      if (!project) throw new NotFoundException(`Project ${id} not found`);

      await manager.softRemove(project);

      await this.auditLogService.record(manager, {
        action: AuditAction.DELETE,
        entityType: AuditEntityType.PROJECT,
        entityId: id,
        performedBy,
        actor: AuditActor.USER,
      });
    });
  }

  findDeleted(): Promise<Project[]> {
    return this.projectRepo.find({
      where: { deletedAt: Not(IsNull()) },
      withDeleted: true,
      order: { id: 'ASC' },
    });
  }

  async getWorkload(projectId: number): Promise<WorkloadEntry[]> {
    const exists = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!exists) throw new NotFoundException(`Project ${projectId} not found`);

    const rows = await this.projectRepo.manager
      .createQueryBuilder(User, 'u')
      .leftJoin(
        Ticket,
        't',
        't.assignee_id = u.id AND t.project_id = :projectId AND t.status != :done AND t.deleted_at IS NULL',
        { projectId, done: TicketStatus.DONE },
      )
      .where('u.role = :role', { role: Role.DEVELOPER })
      .select('u.id', 'userId')
      .addSelect('u.username', 'username')
      .addSelect('COUNT(t.id)::int', 'openTicketCount')
      .groupBy('u.id')
      .addGroupBy('u.username')
      .orderBy('"openTicketCount"', 'ASC')
      .addOrderBy('u.id', 'ASC')
      .getRawMany();

    return rows.map((r) => ({
      userId: Number(r.userId),
      username: r.username as string,
      openTicketCount: Number(r.openTicketCount),
    }));
  }

  async restore(id: number, performedBy: number): Promise<Project> {
    return this.dataSource.transaction(async (manager) => {
      const project = await manager.findOne(Project, {
        where: { id, deletedAt: Not(IsNull()) },
        withDeleted: true,
      });
      if (!project) throw new NotFoundException(`Deleted project ${id} not found`);

      await manager.restore(Project, id);

      await this.auditLogService.record(manager, {
        action: AuditAction.RESTORE,
        entityType: AuditEntityType.PROJECT,
        entityId: id,
        performedBy,
        actor: AuditActor.USER,
      });

      const restored = await manager.findOne(Project, { where: { id } });
      return restored as Project;
    });
  }
}
