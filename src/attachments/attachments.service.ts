import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { DataSource, Repository } from 'typeorm';
import { AuditLogService } from '../audit-log/audit-log.service';
import {
  AuditAction,
  AuditActor,
  AuditEntityType,
} from '../common/enums';
import { Ticket } from '../tickets/ticket.entity';
import { Attachment } from './attachment.entity';

export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10 MB
export const ALLOWED_MIME_TYPES: ReadonlySet<string> = new Set([
  'image/png',
  'image/jpeg',
  'application/pdf',
  'text/plain',
]);

const MIME_EXTENSION: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'application/pdf': '.pdf',
  'text/plain': '.txt',
};

@Injectable()
export class AttachmentsService {
  private readonly uploadRoot: string;

  constructor(
    @InjectRepository(Attachment)
    private readonly attachmentRepo: Repository<Attachment>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
    config: ConfigService,
  ) {
    this.uploadRoot = path.resolve(
      config.get<string>('UPLOAD_DIR', './uploads'),
    );
  }

  async upload(
    ticketId: number,
    file: Express.Multer.File,
    performedBy: number,
  ): Promise<Attachment> {
    if (!file) throw new BadRequestException('File is required');
    if (file.size > MAX_ATTACHMENT_SIZE) {
      throw new BadRequestException(
        `File exceeds maximum size of ${MAX_ATTACHMENT_SIZE} bytes`,
      );
    }
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        `Content type "${file.mimetype}" is not allowed`,
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const ticket = await manager.findOne(Ticket, { where: { id: ticketId } });
      if (!ticket) throw new NotFoundException(`Ticket ${ticketId} not found`);

      const ticketDir = path.join(this.uploadRoot, String(ticketId));
      await fs.mkdir(ticketDir, { recursive: true });

      const ext = MIME_EXTENSION[file.mimetype] ?? '';
      const storagePath = path.join(ticketDir, `${randomUUID()}${ext}`);
      await fs.writeFile(storagePath, file.buffer);

      const attachment = manager.create(Attachment, {
        ticketId,
        filename: file.originalname,
        contentType: file.mimetype,
        sizeBytes: file.size,
        storagePath,
        uploadedBy: performedBy,
      });
      const saved = await manager.save(attachment);

      await this.auditLogService.record(manager, {
        action: AuditAction.UPLOAD_ATTACHMENT,
        entityType: AuditEntityType.TICKET,
        entityId: ticketId,
        performedBy,
        actor: AuditActor.USER,
      });

      return saved;
    });
  }

  async remove(
    ticketId: number,
    attachmentId: number,
    performedBy: number,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const attachment = await manager.findOne(Attachment, {
        where: { id: attachmentId, ticketId },
      });
      if (!attachment) {
        throw new NotFoundException(`Attachment ${attachmentId} not found`);
      }

      await manager.remove(attachment);

      try {
        await fs.unlink(attachment.storagePath);
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
      }

      await this.auditLogService.record(manager, {
        action: AuditAction.DELETE_ATTACHMENT,
        entityType: AuditEntityType.TICKET,
        entityId: ticketId,
        performedBy,
        actor: AuditActor.USER,
      });
    });
  }
}
