import { Controller, Get, Query } from '@nestjs/common';
import { AuditLog } from './audit-log.entity';
import { AuditLogService } from './audit-log.service';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';

@Controller('audit-logs')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  findAll(@Query() query: QueryAuditLogDto): Promise<AuditLog[]> {
    return this.auditLogService.findAll(query);
  }
}
