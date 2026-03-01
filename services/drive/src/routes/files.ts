import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authHook, tenantHook } from '@aris/auth-middleware';
import type { AuthenticatedUser, AuthHookOptions } from '@aris/auth-middleware';
import { FileService } from '../services/file.service';
import { MinioStorage } from '../services/minio.storage';
import { MockScanner } from '../services/mock.scanner';
import { ThumbnailService } from '../services/thumbnail.service';
import {
  PresignSchema,
  ListFilesQuerySchema,
  UuidParamSchema,
  type PresignInput,
  type ListFilesQueryInput,
  type UuidParamInput,
} from '../schemas/file.schema';

export default async function fileRoutes(app: FastifyInstance): Promise<void> {
  const storage = new MinioStorage();
  const scanner = new MockScanner();
  const thumbnailService = new ThumbnailService();
  const fileService = new FileService(app.prisma, app.kafka.producer, storage, scanner, thumbnailService);

  const authOpts: AuthHookOptions = {
    publicKey: process.env['JWT_PUBLIC_KEY'] ?? '',
  };
  const auth = authHook(authOpts);
  const tenant = tenantHook();

  // POST /api/v1/drive/upload — multipart file upload
  app.post('/api/v1/drive/upload', {
    preHandler: [auth, tenant],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const data = await request.file();

    if (!data) {
      return reply.code(400).send({ statusCode: 400, message: 'No file uploaded' });
    }

    const buffer = await data.toBuffer();
    const classification = (data.fields['classification'] as any)?.value ?? 'PUBLIC';
    let metadata: Record<string, unknown> | undefined;
    const metadataField = (data.fields['metadata'] as any)?.value;
    if (metadataField) {
      try { metadata = JSON.parse(metadataField); } catch { /* ignore */ }
    }

    const file = {
      originalname: data.filename,
      mimetype: data.mimetype,
      buffer,
      size: buffer.length,
    };

    const result = await fileService.upload(file, { classification, metadata }, user);
    return reply.code(201).send(result);
  });

  // POST /api/v1/drive/presign — get presigned upload URL
  app.post<{ Body: PresignInput }>('/api/v1/drive/presign', {
    schema: { body: PresignSchema },
    preHandler: [auth, tenant],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return fileService.presign(request.body, user);
  });

  // GET /api/v1/drive/files — list files
  app.get<{ Querystring: ListFilesQueryInput }>('/api/v1/drive/files', {
    schema: { querystring: ListFilesQuerySchema },
    preHandler: [auth, tenant],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return fileService.findAll(user, request.query);
  });

  // GET /api/v1/drive/files/:id — get file metadata
  app.get<{ Params: UuidParamInput }>('/api/v1/drive/files/:id', {
    schema: { params: UuidParamSchema },
    preHandler: [auth, tenant],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return fileService.findOne(request.params.id, user);
  });

  // GET /api/v1/drive/files/:id/download — get presigned download URL
  app.get<{ Params: UuidParamInput }>('/api/v1/drive/files/:id/download', {
    schema: { params: UuidParamSchema },
    preHandler: [auth, tenant],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return fileService.download(request.params.id, user);
  });

  // DELETE /api/v1/drive/files/:id — soft-delete file
  app.delete<{ Params: UuidParamInput }>('/api/v1/drive/files/:id', {
    schema: { params: UuidParamSchema },
    preHandler: [auth, tenant],
  }, async (request) => {
    const user = request.user as AuthenticatedUser;
    return fileService.softDelete(request.params.id, user);
  });
}
