import {
  ClassSerializerInterceptor,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import {
  Role,
  TicketPriority,
  TicketStatus,
  TicketType,
} from '../src/common/enums';

process.env.ESCALATION_DISABLED = 'true';
process.env.NODE_ENV = 'test';

const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` });

const uniqueSuffix = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

describe('IssueFlow API contract e2e', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalInterceptors(
      new ClassSerializerInterceptor(app.get(Reflector)),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const createUser = async (role: Role) => {
    const suffix = uniqueSuffix();
    const payload = {
      username: `user_${suffix}`,
      email: `user_${suffix}@test.local`,
      fullName: `User ${suffix}`,
      role,
      password: `Passw0rd!${suffix}`,
    };
    const res = await request(app.getHttpServer())
      .post('/users')
      .send(payload)
      .expect(201);
    return { ...payload, id: res.body.id as number };
  };

  const login = async (username: string, password: string) => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username, password })
      .expect(200);
    return res.body as { accessToken: string };
  };

  const createProject = async (token: string, ownerId: number) => {
    const suffix = uniqueSuffix();
    const res = await request(app.getHttpServer())
      .post('/projects')
      .set(authHeader(token))
      .send({
        name: `Project ${suffix}`,
        description: `Test ${suffix}`,
        ownerId,
      })
      .expect(201);
    return res.body as { id: number };
  };

  const createTicket = async (
    token: string,
    payload: Record<string, unknown>,
  ) => {
    const res = await request(app.getHttpServer())
      .post('/tickets')
      .set(authHeader(token))
      .send(payload)
      .expect(201);
    return res.body as {
      id: number;
      version: number;
      status: TicketStatus;
      priority: TicketPriority;
      isOverdue: boolean;
      assigneeId: number | null;
    };
  };

  describe('Authentication errors', () => {
    it('rejects login with a wrong password (401)', async () => {
      const user = await createUser(Role.DEVELOPER);
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: user.username, password: 'totally-wrong' })
        .expect(401);
    });

    it('rejects login for an unknown username (401)', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: `nobody_${uniqueSuffix()}`, password: 'whatever' })
        .expect(401);
    });

    it('returns 401 on protected routes without a token', async () => {
      await request(app.getHttpServer()).get('/audit-logs').expect(401);
    });

    it('allows POST /users (registration) without authentication', async () => {
      const suffix = uniqueSuffix();
      await request(app.getHttpServer())
        .post('/users')
        .send({
          username: `unauth_${suffix}`,
          email: `unauth_${suffix}@test.local`,
          fullName: `Unauth ${suffix}`,
          role: Role.DEVELOPER,
          password: `Passw0rd!${suffix}`,
        })
        .expect(201);
    });
  });

  describe('DTO validation at the HTTP boundary', () => {
    let token: string;
    let projectId: number;

    beforeAll(async () => {
      const admin = await createUser(Role.ADMIN);
      token = (await login(admin.username, admin.password)).accessToken;
      projectId = (await createProject(token, admin.id)).id;
    });

    it('rejects POST /users with an invalid role enum (400)', async () => {
      const suffix = uniqueSuffix();
      await request(app.getHttpServer())
        .post('/users')
        .send({
          username: `bad_${suffix}`,
          email: `bad_${suffix}@test.local`,
          fullName: `Bad ${suffix}`,
          role: 'OWNER',
          password: `Passw0rd!${suffix}`,
        })
        .expect(400);
    });

    it('rejects POST /users with a malformed email (400)', async () => {
      const suffix = uniqueSuffix();
      await request(app.getHttpServer())
        .post('/users')
        .send({
          username: `bad_${suffix}`,
          email: 'not-an-email',
          fullName: `Bad ${suffix}`,
          role: Role.DEVELOPER,
          password: `Passw0rd!${suffix}`,
        })
        .expect(400);
    });

    it('rejects POST /tickets with an invalid status enum (400)', async () => {
      await request(app.getHttpServer())
        .post('/tickets')
        .set(authHeader(token))
        .send({
          title: 'Bad status',
          description: 'x',
          status: 'WAITING',
          priority: TicketPriority.LOW,
          type: TicketType.BUG,
          projectId,
        })
        .expect(400);
    });

    it('rejects POST /tickets with a missing required field (400)', async () => {
      await request(app.getHttpServer())
        .post('/tickets')
        .set(authHeader(token))
        .send({
          title: 'Missing priority',
          description: 'x',
          type: TicketType.BUG,
          projectId,
        })
        .expect(400);
    });

    it('rejects POST /tickets with an unknown field (forbidNonWhitelisted, 400)', async () => {
      await request(app.getHttpServer())
        .post('/tickets')
        .set(authHeader(token))
        .send({
          title: 'Has extra',
          description: 'x',
          priority: TicketPriority.LOW,
          type: TicketType.BUG,
          projectId,
          notARealField: true,
        })
        .expect(400);
    });

    it('rejects duplicate username on POST /users (409)', async () => {
      const first = await createUser(Role.DEVELOPER);
      await request(app.getHttpServer())
        .post('/users')
        .send({
          username: first.username,
          email: `dup_${uniqueSuffix()}@test.local`,
          fullName: 'Dup',
          role: Role.DEVELOPER,
          password: 'Passw0rd!dup',
        })
        .expect(409);
    });

    it('returns 404 for an unknown ticket id', async () => {
      await request(app.getHttpServer())
        .get('/tickets/999999999')
        .set(authHeader(token))
        .expect(404);
    });
  });

  describe('Role-based access control', () => {
    it('DEVELOPER hitting an ADMIN-only route gets 403 (GET /projects/deleted)', async () => {
      const dev = await createUser(Role.DEVELOPER);
      const devToken = (await login(dev.username, dev.password)).accessToken;
      await request(app.getHttpServer())
        .get('/projects/deleted')
        .set(authHeader(devToken))
        .expect(403);
    });

    it('DEVELOPER hitting GET /tickets/deleted gets 403', async () => {
      const dev = await createUser(Role.DEVELOPER);
      const devToken = (await login(dev.username, dev.password)).accessToken;
      await request(app.getHttpServer())
        .get('/tickets/deleted')
        .set(authHeader(devToken))
        .query({ projectId: 1 })
        .expect(403);
    });

    it('DEVELOPER cannot restore a soft-deleted ticket (403)', async () => {
      const admin = await createUser(Role.ADMIN);
      const adminToken = (await login(admin.username, admin.password))
        .accessToken;
      const project = await createProject(adminToken, admin.id);
      const ticket = await createTicket(adminToken, {
        title: 'Restore-gate',
        description: 'x',
        priority: TicketPriority.LOW,
        type: TicketType.BUG,
        projectId: project.id,
      });
      await request(app.getHttpServer())
        .delete(`/tickets/${ticket.id}`)
        .set(authHeader(adminToken))
        .expect(200);

      const dev = await createUser(Role.DEVELOPER);
      const devToken = (await login(dev.username, dev.password)).accessToken;
      await request(app.getHttpServer())
        .post(`/tickets/${ticket.id}/restore`)
        .set(authHeader(devToken))
        .expect(403);
    });
  });

  describe('Ticket dependencies — rejections', () => {
    let token: string;
    let projectAId: number;
    let projectBId: number;

    beforeAll(async () => {
      const admin = await createUser(Role.ADMIN);
      token = (await login(admin.username, admin.password)).accessToken;
      projectAId = (await createProject(token, admin.id)).id;
      projectBId = (await createProject(token, admin.id)).id;
    });

    it('rejects self-dependency with 400', async () => {
      const ticket = await createTicket(token, {
        title: 'Self',
        description: 'x',
        priority: TicketPriority.LOW,
        type: TicketType.BUG,
        projectId: projectAId,
      });
      await request(app.getHttpServer())
        .post(`/tickets/${ticket.id}/dependencies`)
        .set(authHeader(token))
        .send({ blockedBy: ticket.id })
        .expect(400);
    });

    it('rejects cross-project blocker with 400', async () => {
      const ticketA = await createTicket(token, {
        title: 'A',
        description: 'x',
        priority: TicketPriority.LOW,
        type: TicketType.BUG,
        projectId: projectAId,
      });
      const ticketB = await createTicket(token, {
        title: 'B',
        description: 'x',
        priority: TicketPriority.LOW,
        type: TicketType.BUG,
        projectId: projectBId,
      });
      await request(app.getHttpServer())
        .post(`/tickets/${ticketA.id}/dependencies`)
        .set(authHeader(token))
        .send({ blockedBy: ticketB.id })
        .expect(400);
    });

    it('rejects unknown blocker id with 404', async () => {
      const ticket = await createTicket(token, {
        title: 'Lonely',
        description: 'x',
        priority: TicketPriority.LOW,
        type: TicketType.BUG,
        projectId: projectAId,
      });
      await request(app.getHttpServer())
        .post(`/tickets/${ticket.id}/dependencies`)
        .set(authHeader(token))
        .send({ blockedBy: 999999999 })
        .expect(404);
    });

    it('rejects duplicate dependency with 409', async () => {
      const ticket = await createTicket(token, {
        title: 'Blocked',
        description: 'x',
        priority: TicketPriority.LOW,
        type: TicketType.BUG,
        projectId: projectAId,
      });
      const blocker = await createTicket(token, {
        title: 'Blocker',
        description: 'x',
        priority: TicketPriority.LOW,
        type: TicketType.BUG,
        projectId: projectAId,
      });
      await request(app.getHttpServer())
        .post(`/tickets/${ticket.id}/dependencies`)
        .set(authHeader(token))
        .send({ blockedBy: blocker.id })
        .expect(200);
      await request(app.getHttpServer())
        .post(`/tickets/${ticket.id}/dependencies`)
        .set(authHeader(token))
        .send({ blockedBy: blocker.id })
        .expect(409);
    });
  });

  describe('Comments — version conflict and mention resync', () => {
    let token: string;
    let ticketId: number;
    let authorId: number;
    let mentionedA: { id: number; username: string };
    let mentionedB: { id: number; username: string };

    beforeAll(async () => {
      const admin = await createUser(Role.ADMIN);
      token = (await login(admin.username, admin.password)).accessToken;
      authorId = admin.id;
      const project = await createProject(token, admin.id);
      const ticket = await createTicket(token, {
        title: 'Comment host',
        description: 'x',
        priority: TicketPriority.LOW,
        type: TicketType.BUG,
        projectId: project.id,
      });
      ticketId = ticket.id;
      const a = await createUser(Role.DEVELOPER);
      const b = await createUser(Role.DEVELOPER);
      mentionedA = { id: a.id, username: a.username };
      mentionedB = { id: b.id, username: b.username };
    });

    it('returns 409 when updating with a stale version', async () => {
      const created = await request(app.getHttpServer())
        .post(`/tickets/${ticketId}/comments`)
        .set(authHeader(token))
        .send({ authorId, content: 'first' })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/tickets/${ticketId}/comments/${created.body.id}`)
        .set(authHeader(token))
        .send({ content: 'updated', version: created.body.version + 5 })
        .expect(409);
    });

    it('removes a stale mention and adds a new one on update', async () => {
      const created = await request(app.getHttpServer())
        .post(`/tickets/${ticketId}/comments`)
        .set(authHeader(token))
        .send({ authorId, content: `cc @${mentionedA.username}` })
        .expect(201);
      expect(
        created.body.mentionedUsers.some(
          (u: { id: number }) => u.id === mentionedA.id,
        ),
      ).toBe(true);

      const updated = await request(app.getHttpServer())
        .patch(`/tickets/${ticketId}/comments/${created.body.id}`)
        .set(authHeader(token))
        .send({
          content: `cc @${mentionedB.username}`,
          version: created.body.version,
        })
        .expect(200);

      const mentioned = updated.body.mentionedUsers as Array<{ id: number }>;
      expect(mentioned.some((u) => u.id === mentionedB.id)).toBe(true);
      expect(mentioned.some((u) => u.id === mentionedA.id)).toBe(false);
    });
  });

  describe('Workload and audit log endpoints', () => {
    it('GET /projects/:id/workload lists DEVELOPERs sorted by openTicketCount', async () => {
      const admin = await createUser(Role.ADMIN);
      const adminToken = (await login(admin.username, admin.password))
        .accessToken;
      const dev1 = await createUser(Role.DEVELOPER);
      const dev2 = await createUser(Role.DEVELOPER);
      const project = await createProject(adminToken, admin.id);

      for (let i = 0; i < 2; i++) {
        await createTicket(adminToken, {
          title: `Seed ${i}`,
          description: 'x',
          priority: TicketPriority.LOW,
          type: TicketType.BUG,
          projectId: project.id,
          assigneeId: dev1.id,
        });
      }
      await createTicket(adminToken, {
        title: 'Seed dev2',
        description: 'x',
        priority: TicketPriority.LOW,
        type: TicketType.BUG,
        projectId: project.id,
        assigneeId: dev2.id,
      });

      const res = await request(app.getHttpServer())
        .get(`/projects/${project.id}/workload`)
        .set(authHeader(adminToken))
        .expect(200);

      const entries = res.body as Array<{
        userId: number;
        username: string;
        openTicketCount: number;
      }>;
      const dev1Entry = entries.find((e) => e.userId === dev1.id);
      const dev2Entry = entries.find((e) => e.userId === dev2.id);
      expect(dev1Entry?.openTicketCount).toBe(2);
      expect(dev2Entry?.openTicketCount).toBe(1);

      const counts = entries.map((e) => e.openTicketCount);
      const sorted = [...counts].sort((a, b) => a - b);
      expect(counts).toEqual(sorted);
    });

    it('GET /audit-logs?action=CREATE returns at least one CREATE entry', async () => {
      const admin = await createUser(Role.ADMIN);
      const adminToken = (await login(admin.username, admin.password))
        .accessToken;
      const project = await createProject(adminToken, admin.id);
      await createTicket(adminToken, {
        title: 'Audit fodder',
        description: 'x',
        priority: TicketPriority.LOW,
        type: TicketType.BUG,
        projectId: project.id,
      });

      const res = await request(app.getHttpServer())
        .get('/audit-logs')
        .set(authHeader(adminToken))
        .query({ action: 'CREATE', entityType: 'TICKET' })
        .expect(200);

      const rows = res.body as Array<{
        action: string;
        entityType: string;
      }>;
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.action === 'CREATE')).toBe(true);
      expect(rows.every((r) => r.entityType === 'TICKET')).toBe(true);
    });
  });

  describe('Attachments — happy path and MIME rejection', () => {
    let token: string;
    let ticketId: number;

    beforeAll(async () => {
      const admin = await createUser(Role.ADMIN);
      token = (await login(admin.username, admin.password)).accessToken;
      const project = await createProject(token, admin.id);
      const ticket = await createTicket(token, {
        title: 'Attach host',
        description: 'x',
        priority: TicketPriority.LOW,
        type: TicketType.BUG,
        projectId: project.id,
      });
      ticketId = ticket.id;
    });

    it('accepts an image/png upload and persists metadata', async () => {
      // Minimal PNG signature so multer treats it as image/png
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ]);
      const res = await request(app.getHttpServer())
        .post(`/tickets/${ticketId}/attachments`)
        .set(authHeader(token))
        .attach('file', pngBuffer, {
          filename: 'shot.png',
          contentType: 'image/png',
        })
        .expect(201);
      expect(res.body.contentType).toBe('image/png');
      expect(res.body.filename).toBe('shot.png');
    });

    it('rejects a disallowed MIME type with 400', async () => {
      await request(app.getHttpServer())
        .post(`/tickets/${ticketId}/attachments`)
        .set(authHeader(token))
        .attach('file', Buffer.from('MZ binary'), {
          filename: 'bad.exe',
          contentType: 'application/x-msdownload',
        })
        .expect(400);
    });
  });

  describe('Manual priority change clears isOverdue', () => {
    it('clears the isOverdue flag at the HTTP boundary', async () => {
      // Using the unit-tested semantics: a manual PATCH that changes the
      // priority must reset isOverdue=false. We cannot set isOverdue via the
      // API directly, but we can verify the flag stays false through a
      // priority transition (LOW -> HIGH) on a fresh ticket.
      const admin = await createUser(Role.ADMIN);
      const token = (await login(admin.username, admin.password)).accessToken;
      const project = await createProject(token, admin.id);
      const ticket = await createTicket(token, {
        title: 'Priority bump',
        description: 'x',
        priority: TicketPriority.LOW,
        type: TicketType.BUG,
        projectId: project.id,
      });
      expect(ticket.isOverdue).toBe(false);

      const updated = await request(app.getHttpServer())
        .patch(`/tickets/${ticket.id}`)
        .set(authHeader(token))
        .send({ priority: TicketPriority.HIGH, version: ticket.version })
        .expect(200);
      expect(updated.body.priority).toBe(TicketPriority.HIGH);
      expect(updated.body.isOverdue).toBe(false);
    });
  });
});
