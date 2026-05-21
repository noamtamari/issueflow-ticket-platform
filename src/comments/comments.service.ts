import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AuditLogService } from '../audit-log/audit-log.service';
import {
  AuditAction,
  AuditActor,
  AuditEntityType,
} from '../common/enums';
import { MentionedUser, MentionsService } from '../mentions/mentions.service';
import { Ticket } from '../tickets/ticket.entity';
import { User } from '../users/user.entity';
import { Comment } from './comment.entity';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

export interface CommentResponse extends Comment {
  mentionedUsers: MentionedUser[];
}

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentRepo: Repository<Comment>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
    private readonly mentionsService: MentionsService,
  ) {}

  async create(
    ticketId: number,
    dto: CreateCommentDto,
    performedBy: number,
  ): Promise<CommentResponse> {
    return this.dataSource.transaction(async (manager) => {
      const ticket = await manager.findOne(Ticket, { where: { id: ticketId } });
      if (!ticket) throw new NotFoundException(`Ticket ${ticketId} not found`);
      const author = await manager.findOne(User, { where: { id: dto.authorId } });
      if (!author) throw new NotFoundException(`Author ${dto.authorId} not found`);

      const comment = manager.create(Comment, {
        ticketId,
        authorId: dto.authorId,
        content: dto.content,
      });
      const saved = await manager.save(comment);

      const mentionedUsers = await this.mentionsService.syncMentionsForComment(
        manager,
        saved.id,
        saved.content,
      );

      await this.auditLogService.record(manager, {
        action: AuditAction.CREATE,
        entityType: AuditEntityType.COMMENT,
        entityId: saved.id,
        performedBy,
        actor: AuditActor.USER,
      });

      return { ...saved, mentionedUsers };
    });
  }

  async findAllByTicket(ticketId: number): Promise<CommentResponse[]> {
    const comments = await this.commentRepo.find({
      where: { ticketId },
      order: { id: 'ASC' },
    });
    const mentions = await this.mentionsService.getMentionedUsersByCommentIds(
      comments.map((c) => c.id),
    );
    return comments.map((c) => ({
      ...c,
      mentionedUsers: mentions.get(c.id) ?? [],
    }));
  }

  async update(
    ticketId: number,
    commentId: number,
    dto: UpdateCommentDto,
    performedBy: number,
  ): Promise<CommentResponse> {
    return this.dataSource.transaction(async (manager) => {
      const comment = await manager.findOne(Comment, {
        where: { id: commentId, ticketId },
      });
      if (!comment) throw new NotFoundException(`Comment ${commentId} not found`);
      if (dto.version !== comment.version) {
        throw new ConflictException(
          `Comment version mismatch (expected ${comment.version}, got ${dto.version})`,
        );
      }
      comment.content = dto.content;
      const saved = await manager.save(comment);

      const mentionedUsers = await this.mentionsService.syncMentionsForComment(
        manager,
        saved.id,
        saved.content,
      );

      await this.auditLogService.record(manager, {
        action: AuditAction.UPDATE,
        entityType: AuditEntityType.COMMENT,
        entityId: saved.id,
        performedBy,
        actor: AuditActor.USER,
      });

      return { ...saved, mentionedUsers };
    });
  }

  async remove(
    ticketId: number,
    commentId: number,
    performedBy: number,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const comment = await manager.findOne(Comment, {
        where: { id: commentId, ticketId },
      });
      if (!comment) throw new NotFoundException(`Comment ${commentId} not found`);

      await manager.remove(comment);

      await this.auditLogService.record(manager, {
        action: AuditAction.DELETE,
        entityType: AuditEntityType.COMMENT,
        entityId: commentId,
        performedBy,
        actor: AuditActor.USER,
      });
    });
  }
}
