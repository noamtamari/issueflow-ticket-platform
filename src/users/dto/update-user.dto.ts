import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { Role } from '../../common/enums';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @Length(1, 128)
  fullName?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
