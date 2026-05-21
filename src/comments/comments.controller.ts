import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserContext } from '../common/types/user-context.type';
import { CommentResponse, CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

@Controller('tickets/:ticketId/comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get()
  findAll(
    @Param('ticketId', ParseIntPipe) ticketId: number,
  ): Promise<CommentResponse[]> {
    return this.commentsService.findAllByTicket(ticketId);
  }

  @Post()
  create(
    @Param('ticketId', ParseIntPipe) ticketId: number,
    @Body() dto: CreateCommentDto,
    @CurrentUser() actor: UserContext,
  ): Promise<CommentResponse> {
    return this.commentsService.create(ticketId, dto, actor.id);
  }

  @Patch(':commentId')
  update(
    @Param('ticketId', ParseIntPipe) ticketId: number,
    @Param('commentId', ParseIntPipe) commentId: number,
    @Body() dto: UpdateCommentDto,
    @CurrentUser() actor: UserContext,
  ): Promise<CommentResponse> {
    return this.commentsService.update(ticketId, commentId, dto, actor.id);
  }

  @Delete(':commentId')
  async remove(
    @Param('ticketId', ParseIntPipe) ticketId: number,
    @Param('commentId', ParseIntPipe) commentId: number,
    @CurrentUser() actor: UserContext,
  ): Promise<void> {
    await this.commentsService.remove(ticketId, commentId, actor.id);
  }
}
