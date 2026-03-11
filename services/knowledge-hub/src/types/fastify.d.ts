import type { authHook } from '@aris/auth-middleware';
import type { PublicationService } from '../services/publication.service';
import type { ELearningService } from '../services/elearning.service';
import type { FaqService } from '../services/faq.service';

declare module 'fastify' {
  interface FastifyInstance {
    authHookFn: ReturnType<typeof authHook>;
    publicationService: PublicationService;
    elearningService: ELearningService;
    faqService: FaqService;
  }
}
