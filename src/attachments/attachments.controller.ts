import {
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserContext } from '../common/types/user-context.type';
import { Attachment } from './attachment.entity';
import { AttachmentsService, MAX_ATTACHMENT_SIZE } from './attachments.service';

@Controller('tickets/:ticketId/attachments')
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_ATTACHMENT_SIZE },
    }),
  )
  upload(
    @Param('ticketId', ParseIntPipe) ticketId: number,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() actor: UserContext,
  ): Promise<Attachment> {
    return this.attachmentsService.upload(ticketId, file, actor.id);
  }

  @Delete(':attachmentId')
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('ticketId', ParseIntPipe) ticketId: number,
    @Param('attachmentId', ParseIntPipe) attachmentId: number,
    @CurrentUser() actor: UserContext,
  ): Promise<void> {
    await this.attachmentsService.remove(ticketId, attachmentId, actor.id);
  }
}
