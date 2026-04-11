import type { FastifyInstance } from 'fastify';
import type { AuthenticatedUser } from '@aris/auth-middleware';
import {
  CreateCourseSchema,
  UpdateCourseSchema,
  CourseFilterSchema,
  AddModuleSchema,
  UpdateModuleSchema,
  ReorderModulesSchema,
  UuidParamSchema,
  ModuleIdParamSchema,
  type CreateCourseInput,
  type UpdateCourseInput,
  type CourseFilterInput,
  type AddModuleInput,
  type UpdateModuleInput,
  type ReorderModulesInput,
  type UuidParamInput,
  type ModuleIdParamInput,
} from '../schemas/knowledge.schema';

const PREFIX = '/api/v1/knowledge/courses';

export async function registerElearningRoutes(app: FastifyInstance): Promise<void> {
  // ─────────────────────────────────────────────────────────────
  // Public (no auth) — only PUBLISHED courses
  // ─────────────────────────────────────────────────────────────

  app.get<{ Querystring: CourseFilterInput }>(
    `${PREFIX}/public`,
    { schema: { querystring: CourseFilterSchema } },
    async (request) => {
      return app.elearningService.findAllCourses(null, request.query);
    },
  );

  app.get<{ Params: UuidParamInput }>(
    `${PREFIX}/public/:id`,
    { schema: { params: UuidParamSchema } },
    async (request) => {
      return app.elearningService.findOneCourse(request.params.id, null);
    },
  );

  // ─────────────────────────────────────────────────────────────
  // Authenticated — user's enrolled courses
  // ─────────────────────────────────────────────────────────────

  app.get(
    `${PREFIX}/my-courses`,
    { preHandler: [app.authHookFn] },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      return app.elearningService.getUserCourses(user);
    },
  );

  // ─────────────────────────────────────────────────────────────
  // Authenticated — course listing & detail
  // ─────────────────────────────────────────────────────────────

  app.get<{ Querystring: CourseFilterInput }>(
    PREFIX,
    {
      schema: { querystring: CourseFilterSchema },
      preHandler: [app.authHookFn],
    },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      return app.elearningService.findAllCourses(user, request.query);
    },
  );

  app.get<{ Params: UuidParamInput }>(
    `${PREFIX}/:id`,
    { schema: { params: UuidParamSchema }, preHandler: [app.authHookFn] },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      return app.elearningService.findOneCourse(request.params.id, user);
    },
  );

  // ─────────────────────────────────────────────────────────────
  // Admin — course management
  // ─────────────────────────────────────────────────────────────

  app.post<{ Body: CreateCourseInput }>(
    PREFIX,
    {
      schema: { body: CreateCourseSchema },
      preHandler: [app.authHookFn],
    },
    async (request, reply) => {
      const user = request.user as AuthenticatedUser;
      const result = await app.elearningService.createCourse(request.body, user);
      return reply.code(201).send(result);
    },
  );

  app.patch<{ Params: UuidParamInput; Body: UpdateCourseInput }>(
    `${PREFIX}/:id`,
    {
      schema: { params: UuidParamSchema, body: UpdateCourseSchema },
      preHandler: [app.authHookFn],
    },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      return app.elearningService.updateCourse(request.params.id, request.body, user);
    },
  );

  app.delete<{ Params: UuidParamInput }>(
    `${PREFIX}/:id`,
    { schema: { params: UuidParamSchema }, preHandler: [app.authHookFn] },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      return app.elearningService.deleteCourse(request.params.id, user);
    },
  );

  // ─── Workflow transitions ─────────────────────────────────────

  app.post<{ Params: UuidParamInput }>(
    `${PREFIX}/:id/publish`,
    { schema: { params: UuidParamSchema }, preHandler: [app.authHookFn] },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      return app.elearningService.publishCourse(request.params.id, user);
    },
  );

  app.post<{ Params: UuidParamInput }>(
    `${PREFIX}/:id/archive`,
    { schema: { params: UuidParamSchema }, preHandler: [app.authHookFn] },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      return app.elearningService.archiveCourse(request.params.id, user);
    },
  );

  // ─── Enrollment ───────────────────────────────────────────────

  app.post<{ Params: UuidParamInput }>(
    `${PREFIX}/:id/enroll`,
    { schema: { params: UuidParamSchema }, preHandler: [app.authHookFn] },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      return app.elearningService.enroll(request.params.id, user);
    },
  );

  app.get<{ Params: UuidParamInput }>(
    `${PREFIX}/:id/progress`,
    { schema: { params: UuidParamSchema }, preHandler: [app.authHookFn] },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      return app.elearningService.getProgress(request.params.id, user);
    },
  );

  // ─── Module management ────────────────────────────────────────

  app.post<{ Params: UuidParamInput; Body: AddModuleInput }>(
    `${PREFIX}/:id/modules`,
    {
      schema: { params: UuidParamSchema, body: AddModuleSchema },
      preHandler: [app.authHookFn],
    },
    async (request, reply) => {
      const user = request.user as AuthenticatedUser;
      const result = await app.elearningService.addModule(request.params.id, request.body, user);
      return reply.code(201).send(result);
    },
  );

  app.patch<{ Params: ModuleIdParamInput; Body: UpdateModuleInput }>(
    `${PREFIX}/:id/modules/:moduleId`,
    {
      schema: { params: ModuleIdParamSchema, body: UpdateModuleSchema },
      preHandler: [app.authHookFn],
    },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      return app.elearningService.updateModule(request.params.id, request.params.moduleId, request.body, user);
    },
  );

  app.delete<{ Params: ModuleIdParamInput }>(
    `${PREFIX}/:id/modules/:moduleId`,
    {
      schema: { params: ModuleIdParamSchema },
      preHandler: [app.authHookFn],
    },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      return app.elearningService.removeModule(request.params.id, request.params.moduleId, user);
    },
  );

  app.post<{ Params: ModuleIdParamInput }>(
    `${PREFIX}/:id/modules/:moduleId/complete`,
    {
      schema: { params: ModuleIdParamSchema },
      preHandler: [app.authHookFn],
    },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      return app.elearningService.completeModule(request.params.id, request.params.moduleId, user);
    },
  );

  app.put<{ Params: UuidParamInput; Body: ReorderModulesInput }>(
    `${PREFIX}/:id/modules/reorder`,
    {
      schema: { params: UuidParamSchema, body: ReorderModulesSchema },
      preHandler: [app.authHookFn],
    },
    async (request) => {
      const user = request.user as AuthenticatedUser;
      return app.elearningService.reorderModules(request.params.id, request.body, user);
    },
  );
}
