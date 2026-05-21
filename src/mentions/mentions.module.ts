import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommentsModule } from '../comments/comments.module';
import { Comment } from '../comments/comment.entity';
import { CommentMention } from './comment-mention.entity';
import { MentionsController } from './mentions.controller';
import { MentionsService } from './mentions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CommentMention, Comment]),
    forwardRef(() => CommentsModule),
  ],
  controllers: [MentionsController],
  providers: [MentionsService],
  exports: [MentionsService],
})
export class MentionsModule {}
