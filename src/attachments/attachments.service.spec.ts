import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { AuditLogService } from '../audit-log/audit-log.service';
import { Ticket } from '../tickets/ticket.entity';
import { Attachment } from './attachment.entity';
import { AttachmentsService } from './attachments.service';

describe('AttachmentsService', () => {
  let service: AttachmentsService;
  let tmpDir: string;
  let manager: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
  };
  const attachmentRepo = { find: jest.fn(), findOne: jest.fn() };
  const dataSource = { transaction: jest.fn() };
  const auditLog = { record: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'issueflow-attach-'));
    manager = {
      findOne: jest.fn(),
      create: jest.fn((_, dto) => dto),
      save: jest.fn(async (e) => ({ id: 200, ...e })),
      remove: jest.fn(),
    };
    dataSource.transaction.mockImplementation(async (cb: any) => cb(manager));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttachmentsService,
        { provide: getRepositoryToken(Attachment), useValue: attachmentRepo },
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: AuditLogService, useValue: auditLog },
        {
          provide: ConfigService,
          useValue: { get: (_: string, fallback: string) => tmpDir },
        },
      ],
    }).compile();
    service = module.get(AttachmentsService);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  const baseFile = (
    overrides: Partial<Express.Multer.File> = {},
  ): Express.Multer.File =>
    ({
      fieldname: 'file',
      originalname: 'screenshot.png',
      encoding: '7bit',
      mimetype: 'image/png',
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      size: 4,
      stream: null as never,
      destination: '',
      filename: '',
      path: '',
      ...overrides,
    }) as Express.Multer.File;

  describe('upload', () => {
    it('writes file to disk and persists Attachment row', async () => {
      manager.findOne.mockResolvedValue({ id: 1 } as Ticket);
      const saved = await service.upload(1, baseFile(), 99);
      expect(saved.id).toBe(200);
      const written = await fs.readFile(saved.storagePath);
      expect(written).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
      expect(auditLog.record).toHaveBeenCalledWith(manager, expect.objectContaining({
        action: 'UPLOAD_ATTACHMENT',
        entityType: 'TICKET',
        entityId: 1,
      }));
    });

    it('rejects files larger than the limit', async () => {
      await expect(
        service.upload(1, baseFile({ size: 11 * 1024 * 1024 }), 99),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects disallowed MIME types', async () => {
      await expect(
        service.upload(1, baseFile({ mimetype: 'application/x-msdownload' }), 99),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when ticket missing', async () => {
      manager.findOne.mockResolvedValue(null);
      await expect(
        service.upload(1, baseFile(), 99),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects when no file supplied', async () => {
      await expect(
        service.upload(1, undefined as never, 99),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('remove', () => {
    it('removes the row and unlinks the file', async () => {
      const filePath = path.join(tmpDir, 'sample.txt');
      await fs.writeFile(filePath, 'hello');
      manager.findOne.mockResolvedValue({
        id: 200,
        ticketId: 1,
        storagePath: filePath,
      });
      await service.remove(1, 200, 99);
      expect(manager.remove).toHaveBeenCalled();
      await expect(fs.access(filePath)).rejects.toThrow();
      expect(auditLog.record).toHaveBeenCalledWith(manager, expect.objectContaining({
        action: 'DELETE_ATTACHMENT',
      }));
    });

    it('tolerates a missing file on disk (ENOENT)', async () => {
      manager.findOne.mockResolvedValue({
        id: 200,
        ticketId: 1,
        storagePath: path.join(tmpDir, 'does-not-exist.txt'),
      });
      await expect(service.remove(1, 200, 99)).resolves.toBeUndefined();
    });

    it('throws NotFoundException when row missing', async () => {
      manager.findOne.mockResolvedValue(null);
      await expect(service.remove(1, 200, 99)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
