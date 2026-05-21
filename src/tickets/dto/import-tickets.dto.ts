import { Type } from 'class-transformer';
import { IsInt, IsPositive } from 'class-validator';

export class ImportTicketsDto {
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  projectId: number;
}

export interface ImportError {
  row: number;
  message: string;
}

export interface ImportSummary {
  created: number;
  failed: number;
  errors: ImportError[];
}
