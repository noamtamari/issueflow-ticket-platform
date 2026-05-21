import { Type } from 'class-transformer';
import { IsInt, IsPositive } from 'class-validator';

export class QueryTicketsDto {
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  projectId: number;
}
