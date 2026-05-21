import {
  AuditAction,
  AuditActor,
  AuditEntityType,
} from '../../common/enums';

export interface RecordAuditDto {
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: number;
  performedBy: number | null;
  actor: AuditActor;
}
