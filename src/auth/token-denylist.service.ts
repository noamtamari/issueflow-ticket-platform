import { Injectable } from '@nestjs/common';

@Injectable()
export class TokenDenylistService {
  private readonly denylist = new Set<string>();

  add(jti: string): void {
    this.denylist.add(jti);
  }

  has(jti: string): boolean {
    return this.denylist.has(jti);
  }

  clear(): void {
    this.denylist.clear();
  }
}
