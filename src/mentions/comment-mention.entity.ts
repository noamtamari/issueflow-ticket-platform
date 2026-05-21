import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Comment } from '../comments/comment.entity';
import { User } from '../users/user.entity';

@Entity('comment_mentions')
@Unique(['commentId', 'mentionedUserId'])
export class CommentMention {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'comment_id' })
  commentId: number;

  @ManyToOne(() => Comment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'comment_id' })
  comment: Comment;

  @Index()
  @Column({ name: 'mentioned_user_id' })
  mentionedUserId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'mentioned_user_id' })
  mentionedUser: User;
}
