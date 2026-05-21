import {
  CreateDateColumn,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Ticket } from '../tickets/ticket.entity';

@Entity('ticket_dependencies')
@Unique(['ticketId', 'blockerId'])
export class TicketDependency {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'ticket_id' })
  ticketId: number;

  @ManyToOne(() => Ticket, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ticket_id' })
  ticket: Ticket;

  @Index()
  @Column({ name: 'blocker_id' })
  blockerId: number;

  @ManyToOne(() => Ticket, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'blocker_id' })
  blocker: Ticket;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
