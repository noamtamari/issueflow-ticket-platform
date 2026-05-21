import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { MentionedUser, MentionsService } from './mentions.service';

@Controller('users/:userId/mentions')
export class MentionsController {
  constructor(private readonly mentionsService: MentionsService) {}

  @Get()
  async findForUser(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
  ): Promise<{
    data: Array<{
      id: number;
      ticketId: number;
      authorId: number;
      content: string;
      mentionedUsers: MentionedUser[];
    }>;
    total: number;
    page: number;
  }> {
    const result = await this.mentionsService.findCommentsByMentionedUser(
      userId,
      page,
      pageSize,
    );
    const mentions = await this.mentionsService.getMentionedUsersByCommentIds(
      result.data.map((c) => c.id),
    );
    return {
      data: result.data.map((c) => ({
        id: c.id,
        ticketId: c.ticketId,
        authorId: c.authorId,
        content: c.content,
        mentionedUsers: mentions.get(c.id) ?? [],
      })),
      total: result.total,
      page: result.page,
    };
  }
}
