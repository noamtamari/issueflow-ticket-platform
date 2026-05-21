import { Role } from '../enums';

export interface UserContext {
  id: number;
  username: string;
  role: Role;
  jti: string;
}
