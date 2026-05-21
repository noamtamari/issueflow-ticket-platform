import { IsInt, IsPositive, IsString, Length } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @Length(1, 128)
  name: string;

  @IsString()
  @Length(0, 4096)
  description: string;

  @IsInt()
  @IsPositive()
  ownerId: number;
}
