import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  Min,
} from 'class-validator';
import {
  TicketPriority,
  TicketStatus,
} from '../../common/enums';

export class UpdateTicketDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  title?: string;

  @IsOptional()
  @IsString()
  @Length(0, 8192)
  description?: string;

  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @IsOptional()
  @IsInt()
  @IsPositive()
  assigneeId?: number | null;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dueDate?: Date | null;

  @IsInt()
  @Min(0)
  version: number;
}
