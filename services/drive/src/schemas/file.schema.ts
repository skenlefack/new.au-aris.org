import { Type, type Static } from '@sinclair/typebox';

export const PresignSchema = Type.Object({
  filename: Type.String({ maxLength: 500 }),
  mimeType: Type.String({ maxLength: 255 }),
  size: Type.Integer({ minimum: 1, maximum: 5368709120 }),
  classification: Type.String(),
  expiresIn: Type.Optional(Type.Integer({ minimum: 60, maximum: 86400 })),
});

export const ListFilesQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  sort: Type.Optional(Type.Union([
    Type.Literal('createdAt'),
    Type.Literal('originalFilename'),
    Type.Literal('size'),
  ])),
  order: Type.Optional(Type.Union([Type.Literal('asc'), Type.Literal('desc')])),
  mimeType: Type.Optional(Type.String()),
  classification: Type.Optional(Type.String()),
});

export const UuidParamSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
});

export type PresignInput = Static<typeof PresignSchema>;
export type ListFilesQueryInput = Static<typeof ListFilesQuerySchema>;
export type UuidParamInput = Static<typeof UuidParamSchema>;
