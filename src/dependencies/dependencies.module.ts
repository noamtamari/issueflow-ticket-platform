import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { DependenciesController } from './dependencies.controller';
import { DependenciesService } from './dependencies.service';
import { TicketDependency } from './ticket-dependency.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TicketDependency]), AuditLogModule],
  controllers: [DependenciesController],
  providers: [DependenciesService],
  exports: [DependenciesService],
})
export class DependenciesModule {}
