import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums';
import { UserContext } from '../common/types/user-context.type';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { ImportSummary, ImportTicketsDto } from './dto/import-tickets.dto';
import { QueryTicketsDto } from './dto/query-tickets.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { Ticket } from './ticket.entity';
import { TicketsService } from './tickets.service';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get()
  findAll(@Query() query: QueryTicketsDto): Promise<Ticket[]> {
    return this.ticketsService.findAllByProject(query.projectId);
  }

  @Roles(Role.ADMIN)
  @Get('deleted')
  findDeleted(@Query() query: QueryTicketsDto): Promise<Ticket[]> {
    return this.ticketsService.findDeleted(query.projectId);
  }

  @Get('export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async export(
    @Query() query: QueryTicketsDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const csv = await this.ticketsService.exportToCsv(query.projectId);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="tickets-project-${query.projectId}.csv"`,
    );
    return csv;
  }

  @Post('import')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 25 * 1024 * 1024 },
    }),
  )
  import(
    @Body() body: ImportTicketsDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() actor: UserContext,
  ): Promise<ImportSummary> {
    return this.ticketsService.importFromCsv(
      body.projectId,
      file.buffer,
      actor.id,
    );
  }

  @Get(':ticketId')
  findOne(@Param('ticketId', ParseIntPipe) ticketId: number): Promise<Ticket> {
    return this.ticketsService.findOne(ticketId);
  }

  @Post()
  create(
    @Body() dto: CreateTicketDto,
    @CurrentUser() actor: UserContext,
  ): Promise<Ticket> {
    return this.ticketsService.create(dto, actor.id);
  }

  @Patch(':ticketId')
  update(
    @Param('ticketId', ParseIntPipe) ticketId: number,
    @Body() dto: UpdateTicketDto,
    @CurrentUser() actor: UserContext,
  ): Promise<Ticket> {
    return this.ticketsService.update(ticketId, dto, actor.id);
  }

  @Delete(':ticketId')
  async remove(
    @Param('ticketId', ParseIntPipe) ticketId: number,
    @CurrentUser() actor: UserContext,
  ): Promise<void> {
    await this.ticketsService.remove(ticketId, actor.id);
  }

  @Roles(Role.ADMIN)
  @Post(':ticketId/restore')
  restore(
    @Param('ticketId', ParseIntPipe) ticketId: number,
    @CurrentUser() actor: UserContext,
  ): Promise<Ticket> {
    return this.ticketsService.restore(ticketId, actor.id);
  }
}
