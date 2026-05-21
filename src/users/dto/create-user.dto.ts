import {
  IsEmail,
  IsEnum,
  IsString,
  Length,
  Matches,
  MinLength,
} from 'class-validator';
import { Role } from '../../common/enums';

export class CreateUserDto {
  @IsString()
  @Length(3, 64)
  @Matches(/^[a-zA-Z0-9_.-]+$/, {
    message: 'username may contain only letters, numbers, _, ., or -',
  })
  username: string;

  @IsEmail()
  @Length(3, 254)
  email: string;

  @IsString()
  @Length(1, 128)
  fullName: string;

  @IsEnum(Role)
  role: Role;

  @IsString()
  @MinLength(6)
  password: string;
}
