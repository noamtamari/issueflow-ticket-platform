import { ClassSerializerInterceptor, INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { Role, TicketPriority, TicketStatus, TicketType } from '../src/common/enums';

process.env.ESCALATION_DISABLED = 'true';
process.env.NODE_ENV = 'test';

const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` });

const uniqueSuffix = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

describe('IssueFlow e2e flows', () => {
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
    app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
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
        description: `Test project ${suffix}`,
        ownerId,
      })
      .expect(201);
    return res.body as { id: number };
  };

  const createTicket = async (token: string, payload: Record<string, unknown>) => {
    const res = await request(app.getHttpServer())
      .post('/tickets')
      .set(authHeader(token))
      .send(payload)
      .expect(201);
    return res.body as { id: number; version: number; status: TicketStatus; assigneeId: number | null };
  };

  it('auth flow: login -> /me -> logout -> token revoked', async () => {
    const user = await createUser(Role.ADMIN);
    const { accessToken } = await login(user.username, user.password);

    await request(app.getHttpServer())
      .get('/auth/me')
      .set(authHeader(accessToken))
      .expect(200);

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set(authHeader(accessToken))
      .expect(200);

    await request(app.getHttpServer())
      .get('/auth/me')
      .set(authHeader(accessToken))
      .expect(401);
  });

  it('auto-assigns to least-loaded developer and enforces status transitions', async () => {
    const admin = await createUser(Role.ADMIN);
    const dev1 = await createUser(Role.DEVELOPER);
    const adminToken = (await login(admin.username, admin.password)).accessToken;

    const project = await createProject(adminToken, admin.id);

    await createTicket(adminToken, {
      title: 'Assigned ticket',
      description: 'Workload seed',
      priority: TicketPriority.LOW,
      type: TicketType.BUG,
      projectId: project.id,
      assigneeId: dev1.id,
    });

    const autoAssigned = await createTicket(adminToken, {
      title: 'Auto assigned ticket',
      description: 'Should go to least loaded dev',
      priority: TicketPriority.MEDIUM,
      type: TicketType.FEATURE,
      projectId: project.id,
    });

    expect(autoAssigned.assigneeId).not.toBeNull();

    const movedToProgress = await request(app.getHttpServer())
      .patch(`/tickets/${autoAssigned.id}`)
      .set(authHeader(adminToken))
      .send({ status: TicketStatus.IN_PROGRESS, version: autoAssigned.version })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/tickets/${autoAssigned.id}`)
      .set(authHeader(adminToken))
      .send({ status: TicketStatus.TODO, version: movedToProgress.body.version })
      .expect(400);

    const movedToReview = await request(app.getHttpServer())
      .patch(`/tickets/${autoAssigned.id}`)
      .set(authHeader(adminToken))
      .send({ status: TicketStatus.IN_REVIEW, version: movedToProgress.body.version })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/tickets/${autoAssigned.id}`)
      .set(authHeader(adminToken))
      .send({ status: TicketStatus.DONE, version: movedToReview.body.version })
      .expect(200);
  });

  it('blocks DONE when dependency unresolved, then allows after blocker resolved', async () => {
    const admin = await createUser(Role.ADMIN);
    const dev = await createUser(Role.DEVELOPER);
    const adminToken = (await login(admin.username, admin.password)).accessToken;

    const project = await createProject(adminToken, admin.id);

    const blocker = await createTicket(adminToken, {
      title: 'Blocker',
      description: 'Blocker ticket',
      priority: TicketPriority.HIGH,
      type: TicketType.BUG,
      projectId: project.id,
      assigneeId: dev.id,
    });

    const blocked = await createTicket(adminToken, {
      title: 'Blocked',
      description: 'Blocked ticket',
      priority: TicketPriority.LOW,
      type: TicketType.TECHNICAL,
      projectId: project.id,
      assigneeId: dev.id,
    });

    await request(app.getHttpServer())
      .post(`/tickets/${blocked.id}/dependencies`)
      .set(authHeader(adminToken))
      .send({ blockedBy: blocker.id })
      .expect(200);

    const blockedProgress = await request(app.getHttpServer())
      .patch(`/tickets/${blocked.id}`)
      .set(authHeader(adminToken))
      .send({ status: TicketStatus.IN_PROGRESS, version: blocked.version })
      .expect(200);

    const blockedReview = await request(app.getHttpServer())
      .patch(`/tickets/${blocked.id}`)
      .set(authHeader(adminToken))
      .send({ status: TicketStatus.IN_REVIEW, version: blockedProgress.body.version })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/tickets/${blocked.id}`)
      .set(authHeader(adminToken))
      .send({ status: TicketStatus.DONE, version: blockedReview.body.version })
      .expect(400);

    const blockerProgress = await request(app.getHttpServer())
      .patch(`/tickets/${blocker.id}`)
      .set(authHeader(adminToken))
      .send({ status: TicketStatus.IN_PROGRESS, version: blocker.version })
      .expect(200);

    const blockerReview = await request(app.getHttpServer())
      .patch(`/tickets/${blocker.id}`)
      .set(authHeader(adminToken))
      .send({ status: TicketStatus.IN_REVIEW, version: blockerProgress.body.version })
      .expect(200);

    const blockerDone = await request(app.getHttpServer())
      .patch(`/tickets/${blocker.id}`)
      .set(authHeader(adminToken))
      .send({ status: TicketStatus.DONE, version: blockerReview.body.version })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/tickets/${blocked.id}`)
      .set(authHeader(adminToken))
      .send({ status: TicketStatus.DONE, version: blockedReview.body.version })
      .expect(200);

    expect(blockerDone.body.status).toBe(TicketStatus.DONE);
  });

  it('mentions show up in /users/:id/mentions', async () => {
    const author = await createUser(Role.DEVELOPER);
    const mentioned = await createUser(Role.DEVELOPER);
    const authorToken = (await login(author.username, author.password)).accessToken;

    const project = await createProject(authorToken, author.id);
    const ticket = await createTicket(authorToken, {
      title: 'Mention ticket',
      description: 'Mentions',
      priority: TicketPriority.MEDIUM,
      type: TicketType.FEATURE,
      projectId: project.id,
      assigneeId: author.id,
    });

    const commentRes = await request(app.getHttpServer())
      .post(`/tickets/${ticket.id}/comments`)
      .set(authHeader(authorToken))
      .send({
        authorId: author.id,
        content: `Hello @${mentioned.username}!`,
      })
      .expect(201);

    const mentionsRes = await request(app.getHttpServer())
      .get(`/users/${mentioned.id}/mentions`)
      .set(authHeader(authorToken))
      .expect(200);

    expect(mentionsRes.body.data.length).toBeGreaterThan(0);
    const matched = mentionsRes.body.data.find((c: any) => c.id === commentRes.body.id);
    expect(matched).toBeDefined();
    expect(matched.mentionedUsers.some((u: any) => u.id === mentioned.id)).toBe(true);
  });

  it('imports CSV then exports tickets', async () => {
    const admin = await createUser(Role.ADMIN);
    const adminToken = (await login(admin.username, admin.password)).accessToken;
    const project = await createProject(adminToken, admin.id);

    const csv = [
      'title,description,status,priority,type,assigneeId',
      'Import Ticket,Imported row,TODO,LOW,BUG,',
    ].join('\n');

    const importRes = await request(app.getHttpServer())
      .post('/tickets/import')
      .set(authHeader(adminToken))
      .field('projectId', String(project.id))
      .attach('file', Buffer.from(csv), 'tickets.csv')
      .expect(200);

    expect(importRes.body.created).toBe(1);

    const exportRes = await request(app.getHttpServer())
      .get('/tickets/export')
      .set(authHeader(adminToken))
      .query({ projectId: project.id })
      .expect(200);

    expect(exportRes.text).toContain('Import Ticket');
  });

  it('soft deletes and restores a ticket', async () => {
    const admin = await createUser(Role.ADMIN);
    const adminToken = (await login(admin.username, admin.password)).accessToken;
    const project = await createProject(adminToken, admin.id);

    const ticket = await createTicket(adminToken, {
      title: 'To delete',
      description: 'Delete me',
      priority: TicketPriority.LOW,
      type: TicketType.TECHNICAL,
      projectId: project.id,
    });

    await request(app.getHttpServer())
      .delete(`/tickets/${ticket.id}`)
      .set(authHeader(adminToken))
      .expect(200);

    await request(app.getHttpServer())
      .get(`/tickets/${ticket.id}`)
      .set(authHeader(adminToken))
      .expect(404);

    const deleted = await request(app.getHttpServer())
      .get('/tickets/deleted')
      .set(authHeader(adminToken))
      .query({ projectId: project.id })
      .expect(200);

    expect(deleted.body.some((t: any) => t.id === ticket.id)).toBe(true);

    await request(app.getHttpServer())
      .post(`/tickets/${ticket.id}/restore`)
      .set(authHeader(adminToken))
      .expect(201);

    await request(app.getHttpServer())
      .get(`/tickets/${ticket.id}`)
      .set(authHeader(adminToken))
      .expect(200);
  });
});
