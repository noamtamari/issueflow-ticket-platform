import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Comment } from '../comments/comment.entity';
import { User } from '../users/user.entity';
import { CommentMention } from './comment-mention.entity';

export interface MentionedUser {
  id: number;
  username: string;
  fullName: string;
}

const MENTION_REGEX = /@([a-zA-Z0-9_.-]+)/g;

@Injectable()
export class MentionsService {
  constructor(
    @InjectRepository(CommentMention)
    private readonly mentionRepo: Repository<CommentMention>,
    @InjectRepository(Comment)
    private readonly commentRepo: Repository<Comment>,
  ) {}

  extractUsernames(content: string): string[] {
    const out = new Set<string>();
    for (const match of content.matchAll(MENTION_REGEX)) {
      out.add(match[1].toLowerCase());
    }
    return Array.from(out);
  }

  async syncMentionsForComment(
    manager: EntityManager,
    commentId: number,
    content: string,
  ): Promise<MentionedUser[]> {
    const usernames = this.extractUsernames(content);

    const users = usernames.length
      ? await manager
          .createQueryBuilder(User, 'u')
          .where('LOWER(u.username) IN (:...usernames)', { usernames })
          .getMany()
      : [];

    const desiredIds = new Set(users.map((u) => u.id));

    const existing = await manager.find(CommentMention, { where: { commentId } });
    const existingIds = new Set(existing.map((m) => m.mentionedUserId));

    const toRemove = existing.filter((m) => !desiredIds.has(m.mentionedUserId));
    if (toRemove.length) await manager.remove(toRemove);

    const toAddIds = [...desiredIds].filter((id) => !existingIds.has(id));
    if (toAddIds.length) {
      const newMentions = toAddIds.map((id) =>
        manager.create(CommentMention, { commentId, mentionedUserId: id }),
      );
      await manager.save(newMentions);
    }

    return users.map((u) => ({ id: u.id, username: u.username, fullName: u.fullName }));
  }

  async getMentionedUsers(commentId: number): Promise<MentionedUser[]> {
    const rows = await this.mentionRepo
      .createQueryBuilder('m')
      .innerJoinAndSelect('m.mentionedUser', 'u')
      .where('m.comment_id = :commentId', { commentId })
      .getMany();
    return rows.map((r) => ({
      id: r.mentionedUser.id,
      username: r.mentionedUser.username,
      fullName: r.mentionedUser.fullName,
    }));
  }

  async getMentionedUsersByCommentIds(
    commentIds: number[],
  ): Promise<Map<number, MentionedUser[]>> {
    const out = new Map<number, MentionedUser[]>();
    if (!commentIds.length) return out;
    const rows = await this.mentionRepo
      .createQueryBuilder('m')
      .innerJoinAndSelect('m.mentionedUser', 'u')
      .where('m.commentId IN (:...commentIds)', { commentIds })
      .getMany();
    for (const id of commentIds) out.set(id, []);
    for (const r of rows) {
      const arr = out.get(r.commentId) ?? [];
      arr.push({ id: r.mentionedUser.id, username: r.mentionedUser.username, fullName: r.mentionedUser.fullName });
      out.set(r.commentId, arr);
    }
    return out;
  }

  async findCommentsByMentionedUser(
    userId: number,
    page: number,
    pageSize: number,
  ): Promise<{ data: Comment[]; total: number; page: number }> {
    const [data, total] = await this.commentRepo
      .createQueryBuilder('c')
      .innerJoin(CommentMention, 'm', 'm.comment_id = c.id')
      .where('m.mentioned_user_id = :userId', { userId })
      .orderBy('c.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return { data, total, page };
  }
}
