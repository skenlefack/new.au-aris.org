// Fastify type augmentations are handled by:
// - ./plugins/prisma.ts → FastifyInstance.prisma
// - @aris/kafka-client/fastify → FastifyInstance.kafka
// - @fastify/multipart → request.file()
//
// This file is intentionally minimal. Add any drive-specific
// Fastify augmentations here if needed in the future.
