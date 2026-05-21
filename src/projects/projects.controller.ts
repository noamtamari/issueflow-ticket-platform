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
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums';
import { UserContext } from '../common/types/user-context.type';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { Project } from './project.entity';
import { ProjectsService, WorkloadEntry } from './projects.service';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  findAll(): Promise<Project[]> {
    return this.projectsService.findAll();
  }

  @Roles(Role.ADMIN)
  @Get('deleted')
  findDeleted(): Promise<Project[]> {
    return this.projectsService.findDeleted();
  }

  @Get(':projectId')
  findOne(
    @Param('projectId', ParseIntPipe) projectId: number,
  ): Promise<Project> {
    return this.projectsService.findOne(projectId);
  }

  @Get(':projectId/workload')
  workload(
    @Param('projectId', ParseIntPipe) projectId: number,
  ): Promise<WorkloadEntry[]> {
    return this.projectsService.getWorkload(projectId);
  }

  @Post()
  create(
    @Body() dto: CreateProjectDto,
    @CurrentUser() actor: UserContext,
  ): Promise<Project> {
    return this.projectsService.create(dto, actor.id);
  }

  @Patch(':projectId')
  update(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() actor: UserContext,
  ): Promise<Project> {
    return this.projectsService.update(projectId, dto, actor.id);
  }

  @Delete(':projectId')
  async remove(
    @Param('projectId', ParseIntPipe) projectId: number,
    @CurrentUser() actor: UserContext,
  ): Promise<void> {
    await this.projectsService.remove(projectId, actor.id);
  }

  @Roles(Role.ADMIN)
  @Post(':projectId/restore')
  restore(
    @Param('projectId', ParseIntPipe) projectId: number,
    @CurrentUser() actor: UserContext,
  ): Promise<Project> {
    return this.projectsService.restore(projectId, actor.id);
  }
}
