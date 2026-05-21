import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttachmentsModule } from './attachments/attachments.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { AuthModule } from './auth/auth.module';
import { CommentsModule } from './comments/comments.module';
import { DependenciesModule } from './dependencies/dependencies.module';
import { MentionsModule } from './mentions/mentions.module';
import { ProjectsModule } from './projects/projects.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { TicketsModule } from './tickets/tickets.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DATABASE_HOST', 'localhost'),
        port: Number(config.get<string>('DATABASE_PORT', '5432')),
        username: config.get<string>('DATABASE_USER', 'issueflow'),
        password: config.get<string>('DATABASE_PASSWORD', 'issueflow'),
        database: config.get<string>('DATABASE_NAME', 'issueflow'),
        autoLoadEntities: true,
        synchronize: config.get<string>('NODE_ENV') !== 'production',
        logging: config.get<string>('TYPEORM_LOGGING') === 'true',
      }),
    }),
    AuditLogModule,
    UsersModule,
    AuthModule,
    ProjectsModule,
    TicketsModule,
    CommentsModule,
    MentionsModule,
    DependenciesModule,
    AttachmentsModule,
    SchedulerModule,
  ],
})
export class AppModule {}
