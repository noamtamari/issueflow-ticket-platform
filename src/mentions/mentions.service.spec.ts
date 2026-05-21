import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { Comment } from '../comments/comment.entity';
import { CommentMention } from './comment-mention.entity';
import { MentionsService } from './mentions.service';

describe('MentionsService', () => {
  let service: MentionsService;
  const mentionRepo = { createQueryBuilder: jest.fn() };
  const commentRepo = { createQueryBuilder: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MentionsService,
        { provide: getRepositoryToken(CommentMention), useValue: mentionRepo },
        { provide: getRepositoryToken(Comment), useValue: commentRepo },
      ],
    }).compile();
    service = module.get(MentionsService);
  });

  describe('extractUsernames', () => {
    it('finds @-mentions and lowercases them', () => {
      expect(service.extractUsernames('Hi @Jdoe and @Asmith')).toEqual([
        'jdoe',
        'asmith',
      ]);
    });

    it('returns deduplicated set', () => {
      expect(service.extractUsernames('@jdoe @JDOE @jdoe')).toEqual(['jdoe']);
    });

    it('returns empty array when no mentions', () => {
      expect(service.extractUsernames('plain text')).toEqual([]);
    });

    it('supports usernames with dot, underscore, dash', () => {
      expect(service.extractUsernames('@user_1 @user.2 @user-3')).toEqual([
        'user_1',
        'user.2',
        'user-3',
      ]);
    });
  });

  describe('syncMentionsForComment', () => {
    let qb: { where: jest.Mock; getMany: jest.Mock };
    let manager: {
      createQueryBuilder: jest.Mock;
      find: jest.Mock;
      remove: jest.Mock;
      create: jest.Mock;
      save: jest.Mock;
    };

    beforeEach(() => {
      qb = { where: jest.fn().mockReturnThis(), getMany: jest.fn() };
      manager = {
        createQueryBuilder: jest.fn().mockReturnValue(qb),
        find: jest.fn(),
        remove: jest.fn(),
        create: jest.fn((_, dto) => dto),
        save: jest.fn(),
      };
    });

    it('adds new mentions on first write, no existing rows', async () => {
      qb.getMany.mockResolvedValue([
        { id: 1, username: 'jdoe', fullName: 'John' },
      ]);
      manager.find.mockResolvedValue([]);
      const result = await service.syncMentionsForComment(
        manager as unknown as EntityManager,
        100,
        'hi @jdoe',
      );
      expect(manager.save).toHaveBeenCalled();
      expect(result).toEqual([{ id: 1, username: 'jdoe', fullName: 'John' }]);
    });

    it('removes stale mentions when content drops them', async () => {
      qb.getMany.mockResolvedValue([]);
      manager.find.mockResolvedValue([
        { id: 50, commentId: 100, mentionedUserId: 7 },
      ]);
      await service.syncMentionsForComment(
        manager as unknown as EntityManager,
        100,
        'no mentions now',
      );
      expect(manager.remove).toHaveBeenCalledWith([
        { id: 50, commentId: 100, mentionedUserId: 7 },
      ]);
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('diffs correctly: keep one, add one, remove one', async () => {
      qb.getMany.mockResolvedValue([
        { id: 1, username: 'jdoe', fullName: 'John' },
        { id: 2, username: 'asmith', fullName: 'Alice' },
      ]);
      manager.find.mockResolvedValue([
        { id: 90, commentId: 100, mentionedUserId: 1 },
        { id: 91, commentId: 100, mentionedUserId: 9 },
      ]);
      await service.syncMentionsForComment(
        manager as unknown as EntityManager,
        100,
        '@jdoe @asmith',
      );
      expect(manager.remove).toHaveBeenCalledWith([
        { id: 91, commentId: 100, mentionedUserId: 9 },
      ]);
      expect(manager.save).toHaveBeenCalledWith([
        expect.objectContaining({ commentId: 100, mentionedUserId: 2 }),
      ]);
    });

    it('skips username lookup entirely when no mentions in content', async () => {
      manager.find.mockResolvedValue([]);
      await service.syncMentionsForComment(
        manager as unknown as EntityManager,
        100,
        'plain text',
      );
      expect(manager.createQueryBuilder).not.toHaveBeenCalled();
    });
  });
});
