import type { authHook } from '@aris/auth-middleware';
import type { PublicationService } from '../services/publication.service';
import type { CategoryService } from '../services/category.service';
import type { SearchService } from '../services/search.service';

declare module 'fastify' {
  interface FastifyInstance {
    authHookFn: ReturnType<typeof authHook>;
    publicationService: PublicationService;
    categoryService: CategoryService;
    searchService: SearchService;
  }
}
