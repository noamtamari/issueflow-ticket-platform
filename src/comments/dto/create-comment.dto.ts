import { IsInt, IsPositive, IsString, Length } from 'class-validator';

export class CreateCommentDto {
  @IsInt()
  @IsPositive()
  authorId: number;

  @IsString()
  @Length(1, 4096)
  content: string;
}
