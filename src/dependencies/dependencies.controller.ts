import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserContext } from '../common/types/user-context.type';
import { Ticket } from '../tickets/ticket.entity';
import { DependenciesService } from './dependencies.service';
import { AddDependencyDto } from './dto/add-dependency.dto';

@Controller('tickets/:ticketId/dependencies')
export class DependenciesController {
  constructor(private readonly dependenciesService: DependenciesService) {}

  @Get()
  list(@Param('ticketId', ParseIntPipe) ticketId: number): Promise<Ticket[]> {
    return this.dependenciesService.listBlockers(ticketId);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  async add(
    @Param('ticketId', ParseIntPipe) ticketId: number,
    @Body() dto: AddDependencyDto,
    @CurrentUser() actor: UserContext,
  ): Promise<void> {
    await this.dependenciesService.add(ticketId, dto.blockedBy, actor.id);
  }

  @Delete(':blockerId')
  async remove(
    @Param('ticketId', ParseIntPipe) ticketId: number,
    @Param('blockerId', ParseIntPipe) blockerId: number,
    @CurrentUser() actor: UserContext,
  ): Promise<void> {
    await this.dependenciesService.remove(ticketId, blockerId, actor.id);
  }
}
