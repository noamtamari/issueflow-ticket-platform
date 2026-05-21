import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';
import { RecordAuditDto } from './dto/record-audit.dto';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  async record(manager: EntityManager, dto: RecordAuditDto): Promise<AuditLog> {
    const entry = manager.create(AuditLog, dto);
    return manager.save(entry);
  }

  async findAll(query: QueryAuditLogDto): Promise<AuditLog[]> {
    const where: Partial<AuditLog> = {};
    if (query.entityType) where.entityType = query.entityType;
    if (query.entityId !== undefined) where.entityId = query.entityId;
    if (query.action) where.action = query.action;
    if (query.actor) where.actor = query.actor;

    return this.auditRepo.find({
      where,
      order: { timestamp: 'DESC' },
    });
  }
}
