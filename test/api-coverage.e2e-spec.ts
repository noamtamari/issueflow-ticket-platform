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

describe('IssueFlow API coverage e2e', () => {
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
    return res.body as { id: number; name: string; description: string };
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
      assigneeId: number | null;
      projectId: number;
    };
  };

  // ---------------------------------------------------------------------------
  // P0 — Users CRUD via HTTP
  // ---------------------------------------------------------------------------
  describe('Users CRUD', () => {
    let adminToken: string;

    beforeAll(async () => {
      const admin = await createUser(Role.ADMIN);
      adminToken = (await login(admin.username, admin.password)).accessToken;
    });

    it('GET /users returns a list that includes a freshly-created user', async () => {
      const target = await createUser(Role.DEVELOPER);
      const res = await request(app.getHttpServer())
        .get('/users')
        .set(authHeader(adminToken))
        .expect(200);
      const list = res.body as Array<{ id: number; username: string }>;
      expect(Array.isArray(list)).toBe(true);
      expect(list.some((u) => u.id === target.id)).toBe(true);
    });

    it('GET /users/:id returns the user without exposing the password', async () => {
      const target = await createUser(Role.DEVELOPER);
      const res = await request(app.getHttpServer())
        .get(`/users/${target.id}`)
        .set(authHeader(adminToken))
        .expect(200);
      expect(res.body.id).toBe(target.id);
      expect(res.body.username).toBe(target.username);
      expect(res.body).not.toHaveProperty('password');
    });

    it('GET /users/:id returns 404 for an unknown user id', async () => {
      await request(app.getHttpServer())
        .get('/users/999999999')
        .set(authHeader(adminToken))
        .expect(404);
    });

    it('POST /users/update/:id updates fullName and role', async () => {
      const target = await createUser(Role.DEVELOPER);
      const res = await request(app.getHttpServer())
        .post(`/users/update/${target.id}`)
        .set(authHeader(adminToken))
        .send({ fullName: 'Updated Name', role: Role.ADMIN })
        .expect(201);
      expect(res.body.fullName).toBe('Updated Name');
      expect(res.body.role).toBe(Role.ADMIN);
    });

    it('DELETE /users/:id removes the user and subsequent GET returns 404', async () => {
      const target = await createUser(Role.DEVELOPER);
      await request(app.getHttpServer())
        .delete(`/users/${target.id}`)
        .set(authHeader(adminToken))
        .expect(200);
      await request(app.getHttpServer())
        .get(`/users/${target.id}`)
        .set(authHeader(adminToken))
        .expect(404);
    });
  });

  // ---------------------------------------------------------------------------
  // P0 — Projects CRUD via HTTP
  // ---------------------------------------------------------------------------
  describe('Projects CRUD and ADMIN-only soft-delete cycle', () => {
    let adminToken: string;
    let adminId: number;

    beforeAll(async () => {
      const admin = await createUser(Role.ADMIN);
      adminId = admin.id;
      adminToken = (await login(admin.username, admin.password)).accessToken;
    });

    it('GET /projects returns a list including a freshly-created project', async () => {
      const project = await createProject(adminToken, adminId);
      const res = await request(app.getHttpServer())
        .get('/projects')
        .set(authHeader(adminToken))
        .expect(200);
      const list = res.body as Array<{ id: number }>;
      expect(list.some((p) => p.id === project.id)).toBe(true);
    });

    it('GET /projects/:id returns the project', async () => {
      const project = await createProject(adminToken, adminId);
      const res = await request(app.getHttpServer())
        .get(`/projects/${project.id}`)
        .set(authHeader(adminToken))
        .expect(200);
      expect(res.body.id).toBe(project.id);
      expect(res.body.name).toBe(project.name);
    });

    it('GET /projects/:id returns 404 for an unknown project', async () => {
      await request(app.getHttpServer())
        .get('/projects/999999999')
        .set(authHeader(adminToken))
        .expect(404);
    });

    it('PATCH /projects/:id updates name and description', async () => {
      const project = await createProject(adminToken, adminId);
      const res = await request(app.getHttpServer())
        .patch(`/projects/${project.id}`)
        .set(authHeader(adminToken))
        .send({ name: 'Renamed', description: 'New desc' })
        .expect(200);
      expect(res.body.name).toBe('Renamed');
      expect(res.body.description).toBe('New desc');
    });

    it('ADMIN can delete → GET /projects/deleted shows it → restore brings it back', async () => {
      const project = await createProject(adminToken, adminId);

      await request(app.getHttpServer())
        .delete(`/projects/${project.id}`)
        .set(authHeader(adminToken))
        .expect(200);

      await request(app.getHttpServer())
        .get(`/projects/${project.id}`)
        .set(authHeader(adminToken))
        .expect(404);

      const deletedList = await request(app.getHttpServer())
        .get('/projects/deleted')
        .set(authHeader(adminToken))
        .expect(200);
      const ids = (deletedList.body as Array<{ id: number }>).map(
        (p) => p.id,
      );
      expect(ids).toContain(project.id);

      await request(app.getHttpServer())
        .post(`/projects/${project.id}/restore`)
        .set(authHeader(adminToken))
        .expect(201);

      const after = await request(app.getHttpServer())
        .get(`/projects/${project.id}`)
        .set(authHeader(adminToken))
        .expect(200);
      expect(after.body.id).toBe(project.id);
    });
  });

  // ---------------------------------------------------------------------------
  // P0 — Tickets coverage gaps
  // ---------------------------------------------------------------------------
  describe('Tickets — read, project scoping, version conflict, DONE lock, assignee override', () => {
    let adminToken: string;
    let projectA: number;
    let projectB: number;
    let dev1Id: number;
    let dev2Id: number;

    beforeAll(async () => {
      const admin = await createUser(Role.ADMIN);
      adminToken = (await login(admin.username, admin.password)).accessToken;
      projectA = (await createProject(adminToken, admin.id)).id;
      projectB = (await createProject(adminToken, admin.id)).id;
      dev1Id = (await createUser(Role.DEVELOPER)).id;
      dev2Id = (await createUser(Role.DEVELOPER)).id;
    });

    it('GET /tickets/:id returns the ticket', async () => {
      const ticket = await createTicket(adminToken, {
        title: 'Readable',
        description: 'x',
        priority: TicketPriority.LOW,
        type: TicketType.BUG,
        projectId: projectA,
        assigneeId: dev1Id,
      });
      const res = await request(app.getHttpServer())
        .get(`/tickets/${ticket.id}`)
        .set(authHeader(adminToken))
        .expect(200);
      expect(res.body.id).toBe(ticket.id);
      expect(res.body.title).toBe('Readable');
    });

    it('GET /tickets?projectId only returns tickets in that project', async () => {
      const inA = await createTicket(adminToken, {
        title: 'A-ticket',
        description: 'x',
        priority: TicketPriority.LOW,
        type: TicketType.BUG,
        projectId: projectA,
        assigneeId: dev1Id,
      });
      const inB = await createTicket(adminToken, {
        title: 'B-ticket',
        description: 'x',
        priority: TicketPriority.LOW,
        type: TicketType.BUG,
        projectId: projectB,
        assigneeId: dev1Id,
      });
      const res = await request(app.getHttpServer())
        .get('/tickets')
        .set(authHeader(adminToken))
        .query({ projectId: projectA })
        .expect(200);
      const ids = (res.body as Array<{ id: number; projectId: number }>).map(
        (t) => t.id,
      );
      expect(ids).toContain(inA.id);
      expect(ids).not.toContain(inB.id);
      expect(
        (res.body as Array<{ projectId: number }>).every(
          (t) => t.projectId === projectA,
        ),
      ).toBe(true);
    });

    it('PATCH /tickets/:id with a stale version returns 409', async () => {
      const ticket = await createTicket(adminToken, {
        title: 'Race',
        description: 'x',
        priority: TicketPriority.LOW,
        type: TicketType.BUG,
        projectId: projectA,
        assigneeId: dev1Id,
      });
      await request(app.getHttpServer())
        .patch(`/tickets/${ticket.id}`)
        .set(authHeader(adminToken))
        .send({ title: 'Bumped', version: ticket.version + 5 })
        .expect(409);
    });

    it('PATCH on a DONE ticket is rejected with 400', async () => {
      const ticket = await createTicket(adminToken, {
        title: 'Finisher',
        description: 'x',
        priority: TicketPriority.LOW,
        type: TicketType.BUG,
        projectId: projectA,
        assigneeId: dev1Id,
      });
      const v1 = await request(app.getHttpServer())
        .patch(`/tickets/${ticket.id}`)
        .set(authHeader(adminToken))
        .send({ status: TicketStatus.IN_PROGRESS, version: ticket.version })
        .expect(200);
      const v2 = await request(app.getHttpServer())
        .patch(`/tickets/${ticket.id}`)
        .set(authHeader(adminToken))
        .send({ status: TicketStatus.IN_REVIEW, version: v1.body.version })
        .expect(200);
      const v3 = await request(app.getHttpServer())
        .patch(`/tickets/${ticket.id}`)
        .set(authHeader(adminToken))
        .send({ status: TicketStatus.DONE, version: v2.body.version })
        .expect(200);
      expect(v3.body.status).toBe(TicketStatus.DONE);

      await request(app.getHttpServer())
        .patch(`/tickets/${ticket.id}`)
        .set(authHeader(adminToken))
        .send({ title: 'Too late', version: v3.body.version })
        .expect(400);
    });

    it('PATCH with explicit assigneeId overrides the current assignee', async () => {
      const ticket = await createTicket(adminToken, {
        title: 'Reassignable',
        description: 'x',
        priority: TicketPriority.LOW,
        type: TicketType.BUG,
        projectId: projectA,
        assigneeId: dev1Id,
      });
      expect(ticket.assigneeId).toBe(dev1Id);

      const res = await request(app.getHttpServer())
        .patch(`/tickets/${ticket.id}`)
        .set(authHeader(adminToken))
        .send({ assigneeId: dev2Id, version: ticket.version })
        .expect(200);
      expect(res.body.assigneeId).toBe(dev2Id);
    });
  });

  // ---------------------------------------------------------------------------
  // P0 — Comments coverage gaps
  // ---------------------------------------------------------------------------
  describe('Comments — list, update content, delete, 404s', () => {
    let adminToken: string;
    let adminId: number;
    let ticketId: number;

    beforeAll(async () => {
      const admin = await createUser(Role.ADMIN);
      adminId = admin.id;
      adminToken = (await login(admin.username, admin.password)).accessToken;
      const project = await createProject(adminToken, admin.id);
      const ticket = await createTicket(adminToken, {
        title: 'Comment-host',
        description: 'x',
        priority: TicketPriority.LOW,
        type: TicketType.BUG,
        projectId: project.id,
      });
      ticketId = ticket.id;
    });

    it('GET /tickets/:id/comments returns the comment list', async () => {
      const created = await request(app.getHttpServer())
        .post(`/tickets/${ticketId}/comments`)
        .set(authHeader(adminToken))
        .send({ authorId: adminId, content: 'first comment' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/tickets/${ticketId}/comments`)
        .set(authHeader(adminToken))
        .expect(200);
      const ids = (res.body as Array<{ id: number }>).map((c) => c.id);
      expect(ids).toContain(created.body.id);
    });

    it('PATCH updates a comment content with a matching version', async () => {
      const created = await request(app.getHttpServer())
        .post(`/tickets/${ticketId}/comments`)
        .set(authHeader(adminToken))
        .send({ authorId: adminId, content: 'original' })
        .expect(201);

      const updated = await request(app.getHttpServer())
        .patch(`/tickets/${ticketId}/comments/${created.body.id}`)
        .set(authHeader(adminToken))
        .send({ content: 'edited', version: created.body.version })
        .expect(200);
      expect(updated.body.content).toBe('edited');
    });

    it('DELETE removes a comment and a follow-up PATCH returns 404', async () => {
      const created = await request(app.getHttpServer())
        .post(`/tickets/${ticketId}/comments`)
        .set(authHeader(adminToken))
        .send({ authorId: adminId, content: 'to delete' })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/tickets/${ticketId}/comments/${created.body.id}`)
        .set(authHeader(adminToken))
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/tickets/${ticketId}/comments/${created.body.id}`)
        .set(authHeader(adminToken))
        .send({ content: 'ghost', version: created.body.version + 1 })
        .expect(404);
    });

    it('PATCH unknown comment id returns 404', async () => {
      await request(app.getHttpServer())
        .patch(`/tickets/${ticketId}/comments/999999999`)
        .set(authHeader(adminToken))
        .send({ content: 'x', version: 1 })
        .expect(404);
    });

    it('POST comment on an unknown ticket returns 404', async () => {
      await request(app.getHttpServer())
        .post('/tickets/999999999/comments')
        .set(authHeader(adminToken))
        .send({ authorId: adminId, content: 'orphan' })
        .expect(404);
    });
  });

  // ---------------------------------------------------------------------------
  // P0 — Dependencies coverage gaps
  // ---------------------------------------------------------------------------
  describe('Dependencies — list, delete, delete-missing', () => {
    let adminToken: string;
    let projectId: number;

    beforeAll(async () => {
      const admin = await createUser(Role.ADMIN);
      adminToken = (await login(admin.username, admin.password)).accessToken;
      projectId = (await createProject(adminToken, admin.id)).id;
    });

    it('GET dependencies returns the blocker ticket', async () => {
      const blocked = await createTicket(adminToken, {
        title: 'Blocked',
        description: 'x',
        priority: TicketPriority.LOW,
        type: TicketType.BUG,
        projectId,
      });
      const blocker = await createTicket(adminToken, {
        title: 'Blocker',
        description: 'x',
        priority: TicketPriority.LOW,
        type: TicketType.BUG,
        projectId,
      });
      await request(app.getHttpServer())
        .post(`/tickets/${blocked.id}/dependencies`)
        .set(authHeader(adminToken))
        .send({ blockedBy: blocker.id })
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`/tickets/${blocked.id}/dependencies`)
        .set(authHeader(adminToken))
        .expect(200);
      const ids = (res.body as Array<{ id: number }>).map((t) => t.id);
      expect(ids).toEqual([blocker.id]);
    });

    it('DELETE a dependency removes it (subsequent GET no longer lists it)', async () => {
      const blocked = await createTicket(adminToken, {
        title: 'B2',
        description: 'x',
        priority: TicketPriority.LOW,
        type: TicketType.BUG,
        projectId,
      });
      const blocker = await createTicket(adminToken, {
        title: 'Blk2',
        description: 'x',
        priority: TicketPriority.LOW,
        type: TicketType.BUG,
        projectId,
      });
      await request(app.getHttpServer())
        .post(`/tickets/${blocked.id}/dependencies`)
        .set(authHeader(adminToken))
        .send({ blockedBy: blocker.id })
        .expect(200);

      await request(app.getHttpServer())
        .delete(`/tickets/${blocked.id}/dependencies/${blocker.id}`)
        .set(authHeader(adminToken))
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`/tickets/${blocked.id}/dependencies`)
        .set(authHeader(adminToken))
        .expect(200);
      expect(res.body).toEqual([]);
    });

    it('DELETE a non-existent dependency returns 404 with a meaningful message', async () => {
      const ticket = await createTicket(adminToken, {
        title: 'Lonely',
        description: 'x',
        priority: TicketPriority.LOW,
        type: TicketType.BUG,
        projectId,
      });
      const res = await request(app.getHttpServer())
        .delete(`/tickets/${ticket.id}/dependencies/999999999`)
        .set(authHeader(adminToken))
        .expect(404);
      expect(typeof res.body.message).toBe('string');
      expect(res.body.message.length).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // P1 — Attachments: pdf + text accepted; missing file rejected
  // ---------------------------------------------------------------------------
  describe('Attachments — MIME allow-list coverage', () => {
    let adminToken: string;
    let ticketId: number;

    beforeAll(async () => {
      const admin = await createUser(Role.ADMIN);
      adminToken = (await login(admin.username, admin.password)).accessToken;
      const project = await createProject(adminToken, admin.id);
      const ticket = await createTicket(adminToken, {
        title: 'Attach host',
        description: 'x',
        priority: TicketPriority.LOW,
        type: TicketType.BUG,
        projectId: project.id,
      });
      ticketId = ticket.id;
    });

    it('accepts application/pdf', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4\n%fake');
      const res = await request(app.getHttpServer())
        .post(`/tickets/${ticketId}/attachments`)
        .set(authHeader(adminToken))
        .attach('file', pdfBuffer, {
          filename: 'doc.pdf',
          contentType: 'application/pdf',
        })
        .expect(201);
      expect(res.body.contentType).toBe('application/pdf');
    });

    it('accepts text/plain', async () => {
      const txt = Buffer.from('hello attachment');
      const res = await request(app.getHttpServer())
        .post(`/tickets/${ticketId}/attachments`)
        .set(authHeader(adminToken))
        .attach('file', txt, {
          filename: 'note.txt',
          contentType: 'text/plain',
        })
        .expect(201);
      expect(res.body.contentType).toBe('text/plain');
    });

    it('rejects an upload with no file field (400)', async () => {
      await request(app.getHttpServer())
        .post(`/tickets/${ticketId}/attachments`)
        .set(authHeader(adminToken))
        .expect(400);
    });
  });

  // ---------------------------------------------------------------------------
  // P1 — CSV import HTTP-boundary edge cases
  // ---------------------------------------------------------------------------
  describe('CSV import — RFC 4180 quoting, partial failure, missing projectId', () => {
    let adminToken: string;
    let projectId: number;

    beforeAll(async () => {
      const admin = await createUser(Role.ADMIN);
      adminToken = (await login(admin.username, admin.password)).accessToken;
      projectId = (await createProject(adminToken, admin.id)).id;
    });

    it('imports rows whose fields contain commas and escaped quotes', async () => {
      const csv = [
        'title,description,status,priority,type,assigneeId',
        '"Fix, comma","Has ""quotes""",TODO,LOW,BUG,',
      ].join('\n');

      const importRes = await request(app.getHttpServer())
        .post('/tickets/import')
        .set(authHeader(adminToken))
        .field('projectId', String(projectId))
        .attach('file', Buffer.from(csv), 'tickets.csv')
        .expect(200);
      expect(importRes.body.created).toBe(1);
      expect(importRes.body.failed).toBe(0);

      const exportRes = await request(app.getHttpServer())
        .get('/tickets/export')
        .set(authHeader(adminToken))
        .query({ projectId })
        .expect(200);
      expect(exportRes.text).toContain('"Fix, comma"');
      expect(exportRes.text).toContain('"Has ""quotes"""');
    });

    it('returns per-row errors for invalid rows and continues with valid ones', async () => {
      const csv = [
        'title,description,status,priority,type,assigneeId',
        'Good,desc,TODO,LOW,BUG,',
        ',no-title,TODO,LOW,BUG,',
        'BadEnum,desc,TODO,LOW,WAT,',
      ].join('\n');

      const res = await request(app.getHttpServer())
        .post('/tickets/import')
        .set(authHeader(adminToken))
        .field('projectId', String(projectId))
        .attach('file', Buffer.from(csv), 'tickets.csv')
        .expect(200);
      expect(res.body.created).toBe(1);
      expect(res.body.failed).toBe(2);
      expect(Array.isArray(res.body.errors)).toBe(true);
      expect(res.body.errors).toHaveLength(2);
      expect(res.body.errors[0]).toMatchObject({ row: expect.any(Number) });
    });

    it('rejects POST /tickets/import without a projectId field (400)', async () => {
      const csv = 'title,description,status,priority,type,assigneeId\n';
      await request(app.getHttpServer())
        .post('/tickets/import')
        .set(authHeader(adminToken))
        .attach('file', Buffer.from(csv), 'tickets.csv')
        .expect(400);
    });
  });

  // ---------------------------------------------------------------------------
  // P1 — Audit log persistence at HTTP level (UPDATE / DELETE / RESTORE / AUTO_ASSIGN)
  // ---------------------------------------------------------------------------
  describe('Audit log persistence — state-changing actions are recorded', () => {
    let adminToken: string;
    let projectId: number;

    beforeAll(async () => {
      const admin = await createUser(Role.ADMIN);
      adminToken = (await login(admin.username, admin.password)).accessToken;
      projectId = (await createProject(adminToken, admin.id)).id;
      // Ensure at least one DEVELOPER exists so auto-assign can resolve.
      await createUser(Role.DEVELOPER);
    });

    const fetchLogs = (q: Record<string, string | number>) =>
      request(app.getHttpServer())
        .get('/audit-logs')
        .set(authHeader(adminToken))
        .query(q);

    it('records an UPDATE entry when a ticket is patched', async () => {
      const ticket = await createTicket(adminToken, {
        title: 'Audit-update',
        description: 'x',
        priority: TicketPriority.LOW,
        type: TicketType.BUG,
        projectId,
      });
      await request(app.getHttpServer())
        .patch(`/tickets/${ticket.id}`)
        .set(authHeader(adminToken))
        .send({ title: 'Renamed', version: ticket.version })
        .expect(200);

      const res = await fetchLogs({
        entityType: 'TICKET',
        entityId: ticket.id,
        action: 'UPDATE',
      }).expect(200);
      expect((res.body as unknown[]).length).toBeGreaterThan(0);
    });

    it('records a DELETE entry when a ticket is soft-deleted', async () => {
      const ticket = await createTicket(adminToken, {
        title: 'Audit-delete',
        description: 'x',
        priority: TicketPriority.LOW,
        type: TicketType.BUG,
        projectId,
      });
      await request(app.getHttpServer())
        .delete(`/tickets/${ticket.id}`)
        .set(authHeader(adminToken))
        .expect(200);

      const res = await fetchLogs({
        entityType: 'TICKET',
        entityId: ticket.id,
        action: 'DELETE',
      }).expect(200);
      expect((res.body as unknown[]).length).toBeGreaterThan(0);
    });

    it('records a RESTORE entry when a ticket is restored', async () => {
      const ticket = await createTicket(adminToken, {
        title: 'Audit-restore',
        description: 'x',
        priority: TicketPriority.LOW,
        type: TicketType.BUG,
        projectId,
      });
      await request(app.getHttpServer())
        .delete(`/tickets/${ticket.id}`)
        .set(authHeader(adminToken))
        .expect(200);
      await request(app.getHttpServer())
        .post(`/tickets/${ticket.id}/restore`)
        .set(authHeader(adminToken))
        .expect(201);

      const res = await fetchLogs({
        entityType: 'TICKET',
        entityId: ticket.id,
        action: 'RESTORE',
      }).expect(200);
      expect((res.body as unknown[]).length).toBeGreaterThan(0);
    });

    it('records an AUTO_ASSIGN entry with actor=SYSTEM and performedBy=null', async () => {
      // Omitting assigneeId triggers the auto-assignment path.
      const ticket = await createTicket(adminToken, {
        title: 'Audit-autoassign',
        description: 'x',
        priority: TicketPriority.LOW,
        type: TicketType.BUG,
        projectId,
      });

      const res = await fetchLogs({
        entityType: 'TICKET',
        entityId: ticket.id,
        action: 'AUTO_ASSIGN',
      }).expect(200);
      const rows = res.body as Array<{
        actor: string;
        performedBy: number | null;
      }>;
      expect(rows.length).toBeGreaterThan(0);
      expect(rows[0].actor).toBe('SYSTEM');
      expect(rows[0].performedBy).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // P2 — Auth/security and error response shape
  // ---------------------------------------------------------------------------
  describe('Auth/security — token edge cases and /auth/me shape', () => {
    let adminToken: string;
    let adminUsername: string;

    beforeAll(async () => {
      const admin = await createUser(Role.ADMIN);
      adminUsername = admin.username;
      adminToken = (await login(admin.username, admin.password)).accessToken;
    });

    it('rejects a malformed JWT with 401', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer not.a.real.jwt')
        .expect(401);
    });

    it('rejects POST /auth/logout without an Authorization header with 401', async () => {
      await request(app.getHttpServer()).post('/auth/logout').expect(401);
    });

    it('GET /auth/me does not expose the password field', async () => {
      const res = await request(app.getHttpServer())
        .get('/auth/me')
        .set(authHeader(adminToken))
        .expect(200);
      expect(res.body.username).toBe(adminUsername);
      expect(res.body).not.toHaveProperty('password');
    });
  });

  describe('Error response envelope from AllExceptionsFilter', () => {
    let adminToken: string;
    let projectId: number;

    beforeAll(async () => {
      const admin = await createUser(Role.ADMIN);
      adminToken = (await login(admin.username, admin.password)).accessToken;
      projectId = (await createProject(adminToken, admin.id)).id;
    });

    const assertEnvelope = (body: unknown, expectedStatus: number) => {
      const b = body as Record<string, unknown>;
      expect(b).toMatchObject({
        statusCode: expectedStatus,
        path: expect.any(String),
        timestamp: expect.any(String),
      });
      expect(b.message).toBeDefined();
      expect(b.error).toBeDefined();
    };

    it('400 validation error has the standard envelope and a useful message', async () => {
      const res = await request(app.getHttpServer())
        .post('/tickets')
        .set(authHeader(adminToken))
        .send({
          title: 'no-priority',
          description: 'x',
          type: TicketType.BUG,
          projectId,
        })
        .expect(400);
      assertEnvelope(res.body, 400);
      const msg = Array.isArray(res.body.message)
        ? res.body.message.join(' ')
        : String(res.body.message);
      expect(msg.toLowerCase()).toContain('priority');
    });

    it('404 not-found error has the standard envelope and a useful message', async () => {
      const res = await request(app.getHttpServer())
        .get('/tickets/999999999')
        .set(authHeader(adminToken))
        .expect(404);
      assertEnvelope(res.body, 404);
      const msg = Array.isArray(res.body.message)
        ? res.body.message.join(' ')
        : String(res.body.message);
      expect(msg.toLowerCase()).toContain('ticket');
    });

    it('409 conflict error has the standard envelope and a useful message', async () => {
      const suffix = uniqueSuffix();
      const first = {
        username: `dup_${suffix}`,
        email: `dup_${suffix}@test.local`,
        fullName: 'Dup',
        role: Role.DEVELOPER,
        password: `Passw0rd!${suffix}`,
      };
      await request(app.getHttpServer())
        .post('/users')
        .send(first)
        .expect(201);
      const res = await request(app.getHttpServer())
        .post('/users')
        .send({
          ...first,
          email: `other_${suffix}@test.local`,
        })
        .expect(409);
      assertEnvelope(res.body, 409);
    });
  });
});
