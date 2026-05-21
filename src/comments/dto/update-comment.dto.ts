import { IsInt, IsString, Length, Min } from 'class-validator';

export class UpdateCommentDto {
  @IsString()
  @Length(1, 4096)
  content: string;

  @IsInt()
  @Min(0)
  version: number;
}
