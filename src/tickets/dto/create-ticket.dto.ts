import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Length,
} from 'class-validator';
import {
  TicketPriority,
  TicketStatus,
  TicketType,
} from '../../common/enums';

export class CreateTicketDto {
  @IsString()
  @Length(1, 200)
  title: string;

  @IsString()
  @Length(0, 8192)
  description: string;

  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @IsEnum(TicketPriority)
  priority: TicketPriority;

  @IsEnum(TicketType)
  type: TicketType;

  @IsInt()
  @IsPositive()
  projectId: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  assigneeId?: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dueDate?: Date;
}
