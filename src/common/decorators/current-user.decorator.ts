import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserContext } from '../types/user-context.type';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UserContext => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
