import {
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { AuditLogService } from '../audit-log/audit-log.service';
import { MentionsService } from '../mentions/mentions.service';
import { Ticket } from '../tickets/ticket.entity';
import { User } from '../users/user.entity';
import { Comment } from './comment.entity';
import { CommentsService } from './comments.service';

describe('CommentsService', () => {
  let service: CommentsService;
  let manager: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
  };
  const commentRepo = { find: jest.fn() };
  const dataSource = { transaction: jest.fn() };
  const auditLog = { record: jest.fn() };
  const mentions = {
    syncMentionsForComment: jest.fn(),
    getMentionedUsersByCommentIds: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    manager = {
      findOne: jest.fn(),
      create: jest.fn((_, dto) => dto),
      save: jest.fn(async (e) => ({ id: 300, version: 1, ...e })),
      remove: jest.fn(),
    };
    dataSource.transaction.mockImplementation(async (cb: any) => cb(manager));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        { provide: getRepositoryToken(Comment), useValue: commentRepo },
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: AuditLogService, useValue: auditLog },
        { provide: MentionsService, useValue: mentions },
      ],
    }).compile();
    service = module.get(CommentsService);
  });

  describe('create', () => {
    it('persists comment, syncs mentions, and writes CREATE audit log', async () => {
      manager.findOne
        .mockResolvedValueOnce({ id: 1 } as Ticket)
        .mockResolvedValueOnce({ id: 2 } as User);
      mentions.syncMentionsForComment.mockResolvedValue([
        { id: 3, username: 'jdoe', fullName: 'John' },
      ]);

      const result = await service.create(
        1,
        { authorId: 2, content: 'Hello @jdoe' },
        2,
      );

      expect(result.id).toBe(300);
      expect(result.mentionedUsers).toEqual([
        { id: 3, username: 'jdoe', fullName: 'John' },
      ]);
      expect(mentions.syncMentionsForComment).toHaveBeenCalledWith(
        manager,
        300,
        'Hello @jdoe',
      );
      expect(auditLog.record).toHaveBeenCalledWith(
        manager,
        expect.objectContaining({
          action: 'CREATE',
          entityType: 'COMMENT',
          entityId: 300,
          performedBy: 2,
        }),
      );
    });

    it('throws NotFoundException when ticket missing', async () => {
      manager.findOne.mockResolvedValueOnce(null);
      await expect(
        service.create(1, { authorId: 2, content: 'hi' }, 2),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws NotFoundException when author missing', async () => {
      manager.findOne
        .mockResolvedValueOnce({ id: 1 } as Ticket)
        .mockResolvedValueOnce(null);
      await expect(
        service.create(1, { authorId: 99, content: 'hi' }, 2),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update', () => {
    const baseComment = (overrides: Partial<Comment> = {}): Comment =>
      ({
        id: 50,
        ticketId: 1,
        authorId: 2,
        content: 'old',
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        ticket: {} as Ticket,
        author: {} as User,
        ...overrides,
      }) as Comment;

    it('throws NotFoundException when comment missing', async () => {
      manager.findOne.mockResolvedValueOnce(null);
      await expect(
        service.update(1, 50, { version: 1, content: 'new' }, 2),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ConflictException on version mismatch', async () => {
      manager.findOne.mockResolvedValueOnce(baseComment({ version: 4 }));
      await expect(
        service.update(1, 50, { version: 2, content: 'new' }, 2),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('re-evaluates mentions and writes UPDATE audit log on success', async () => {
      manager.findOne.mockResolvedValueOnce(baseComment());
      mentions.syncMentionsForComment.mockResolvedValue([
        { id: 7, username: 'asmith', fullName: 'A Smith' },
      ]);

      const result = await service.update(
        1,
        50,
        { version: 1, content: 'Hello @asmith' },
        2,
      );

      expect(result.content).toBe('Hello @asmith');
      expect(result.mentionedUsers).toEqual([
        { id: 7, username: 'asmith', fullName: 'A Smith' },
      ]);
      expect(mentions.syncMentionsForComment).toHaveBeenCalledWith(
        manager,
        50,
        'Hello @asmith',
      );
      expect(auditLog.record).toHaveBeenCalledWith(
        manager,
        expect.objectContaining({
          action: 'UPDATE',
          entityType: 'COMMENT',
        }),
      );
    });
  });

  describe('remove', () => {
    it('removes comment and writes DELETE audit log', async () => {
      const comment = { id: 50, ticketId: 1 };
      manager.findOne.mockResolvedValueOnce(comment);
      await service.remove(1, 50, 2);
      expect(manager.remove).toHaveBeenCalledWith(comment);
      expect(auditLog.record).toHaveBeenCalledWith(
        manager,
        expect.objectContaining({
          action: 'DELETE',
          entityType: 'COMMENT',
          entityId: 50,
        }),
      );
    });

    it('throws NotFoundException when comment missing', async () => {
      manager.findOne.mockResolvedValueOnce(null);
      await expect(service.remove(1, 50, 2)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('findAllByTicket', () => {
    it('attaches mentionedUsers map (empty array when none)', async () => {
      commentRepo.find.mockResolvedValue([
        { id: 10, ticketId: 1, content: 'a' },
        { id: 11, ticketId: 1, content: 'b' },
      ]);
      mentions.getMentionedUsersByCommentIds.mockResolvedValue(
        new Map([[10, [{ id: 3, username: 'jdoe', fullName: 'John' }]]]),
      );

      const result = await service.findAllByTicket(1);

      expect(result[0].mentionedUsers).toEqual([
        { id: 3, username: 'jdoe', fullName: 'John' },
      ]);
      expect(result[1].mentionedUsers).toEqual([]);
    });
  });
});
