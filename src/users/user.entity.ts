import { Exclude } from 'class-transformer';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Role } from '../common/enums';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column({ length: 64 })
  username: string;

  @Index({ unique: true })
  @Column({ length: 254 })
  email: string;

  @Column({ name: 'full_name', length: 128 })
  fullName: string;

  @Column({ type: 'enum', enum: Role })
  role: Role;

  @Exclude({ toPlainOnly: true })
  @Column({ length: 128 })
  password: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
