import { Type, Static } from '@sinclair/typebox';

export const SlideshowTransitionSchema = Type.Union([
  Type.Literal('FADE'),
  Type.Literal('SLIDE_LEFT'),
  Type.Literal('SLIDE_RIGHT'),
  Type.Literal('ZOOM'),
  Type.Literal('FLIP'),
]);

export const CreateSlideshowSchema = Type.Object({
  titleFr: Type.String({ minLength: 1 }),
  titleEn: Type.String({ minLength: 1 }),
  titleAr: Type.Optional(Type.String()),
  titlePt: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  transition: Type.Optional(SlideshowTransitionSchema),
  intervalMs: Type.Optional(Type.Integer({ minimum: 3000, maximum: 300000, default: 15000 })),
  autoPlay: Type.Optional(Type.Boolean({ default: true })),
  loop: Type.Optional(Type.Boolean({ default: true })),
  showProgress: Type.Optional(Type.Boolean({ default: true })),
  showControls: Type.Optional(Type.Boolean({ default: false })),
  slides: Type.Optional(Type.Array(Type.Object({
    dashboardId: Type.String({ format: 'uuid' }),
    sortOrder: Type.Integer({ minimum: 0 }),
    durationMs: Type.Optional(Type.Integer({ minimum: 3000, maximum: 300000 })),
    transition: Type.Optional(SlideshowTransitionSchema),
  }))),
});
export type CreateSlideshowDto = Static<typeof CreateSlideshowSchema>;

export const UpdateSlideshowSchema = Type.Partial(Type.Object({
  titleFr: Type.String({ minLength: 1 }),
  titleEn: Type.String({ minLength: 1 }),
  titleAr: Type.String(),
  titlePt: Type.String(),
  description: Type.String(),
  isActive: Type.Boolean(),
  transition: SlideshowTransitionSchema,
  intervalMs: Type.Integer({ minimum: 3000, maximum: 300000 }),
  autoPlay: Type.Boolean(),
  loop: Type.Boolean(),
  showProgress: Type.Boolean(),
  showControls: Type.Boolean(),
}));
export type UpdateSlideshowDto = Static<typeof UpdateSlideshowSchema>;

export const UpdateSlidesSchema = Type.Object({
  slides: Type.Array(Type.Object({
    dashboardId: Type.String({ format: 'uuid' }),
    sortOrder: Type.Integer({ minimum: 0 }),
    durationMs: Type.Optional(Type.Integer({ minimum: 3000, maximum: 300000 })),
    transition: Type.Optional(SlideshowTransitionSchema),
  })),
});
export type UpdateSlidesDto = Static<typeof UpdateSlidesSchema>;

export const ListSlideshowsQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
});
export type ListSlideshowsQuery = Static<typeof ListSlideshowsQuerySchema>;

export type SlideshowIdParam = { id: string };
export type SlideIdParam = { id: string; slideId: string };
