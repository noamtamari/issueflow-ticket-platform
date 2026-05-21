import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { DataSource, Repository } from 'typeorm';
import {
  AuditAction,
  AuditActor,
  AuditEntityType,
} from '../common/enums';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './user.entity';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly auditLogService: AuditLogService,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    await this.ensureUnique(dto.username, dto.email);
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    return this.dataSource.transaction(async (manager) => {
      const user = manager.create(User, { ...dto, password: passwordHash });
      const saved = await manager.save(user);

      await this.auditLogService.record(manager, {
        action: AuditAction.CREATE,
        entityType: AuditEntityType.USER,
        entityId: saved.id,
        performedBy: saved.id,
        actor: AuditActor.USER,
      });

      return saved;
    });
  }

  findAll(): Promise<User[]> {
    return this.userRepo.find({ order: { id: 'ASC' } });
  }

  async findOne(id: number): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  findByUsername(username: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { username } });
  }

  async update(
    id: number,
    dto: UpdateUserDto,
    performedBy: number,
  ): Promise<User> {
    return this.dataSource.transaction(async (manager) => {
      const user = await manager.findOne(User, { where: { id } });
      if (!user) throw new NotFoundException(`User ${id} not found`);

      if (dto.fullName !== undefined) user.fullName = dto.fullName;
      if (dto.role !== undefined) user.role = dto.role;
      const saved = await manager.save(user);

      await this.auditLogService.record(manager, {
        action: AuditAction.UPDATE,
        entityType: AuditEntityType.USER,
        entityId: saved.id,
        performedBy,
        actor: AuditActor.USER,
      });

      return saved;
    });
  }

  async remove(id: number, performedBy: number): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const user = await manager.findOne(User, { where: { id } });
      if (!user) throw new NotFoundException(`User ${id} not found`);

      await manager.remove(user);

      await this.auditLogService.record(manager, {
        action: AuditAction.DELETE,
        entityType: AuditEntityType.USER,
        entityId: id,
        performedBy,
        actor: AuditActor.USER,
      });
    });
  }

  private async ensureUnique(username: string, email: string): Promise<void> {
    const conflict = await this.userRepo
      .createQueryBuilder('u')
      .where('u.username = :username OR u.email = :email', { username, email })
      .getOne();
    if (!conflict) return;
    if (conflict.username === username) {
      throw new ConflictException(`Username "${username}" already exists`);
    }
    throw new ConflictException(`Email "${email}" already exists`);
  }
}
