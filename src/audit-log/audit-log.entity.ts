import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import {
  AuditAction,
  AuditActor,
  AuditEntityType,
} from '../common/enums';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: 'enum', enum: AuditAction })
  action: AuditAction;

  @Index()
  @Column({ type: 'enum', enum: AuditEntityType, name: 'entity_type' })
  entityType: AuditEntityType;

  @Index()
  @Column({ type: 'int', name: 'entity_id' })
  entityId: number;

  @Column({ type: 'int', name: 'performed_by', nullable: true })
  performedBy: number | null;

  @Index()
  @Column({ type: 'enum', enum: AuditActor })
  actor: AuditActor;

  @CreateDateColumn({ name: 'timestamp' })
  timestamp: Date;
}
