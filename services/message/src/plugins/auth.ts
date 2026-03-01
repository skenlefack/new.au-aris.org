import fp from 'fastify-plugin';
import { readFileSync } from 'fs';
import { authHook } from '@aris/auth-middleware/fastify';
import type { AuthHookOptions } from '@aris/auth-middleware/fastify';
import type { FastifyInstance } from 'fastify';

export default fp(
  async (app: FastifyInstance) => {
    let publicKey = (process.env['JWT_PUBLIC_KEY'] ?? '').replace(/\\n/g, '\n');
    if (!publicKey && process.env['JWT_PUBLIC_KEY_PATH']) {
      try {
        publicKey = readFileSync(process.env['JWT_PUBLIC_KEY_PATH'], 'utf8');
      } catch { /* key file not found */ }
    }

    const authOptions: AuthHookOptions = { publicKey };
    app.decorate('authHookFn', authHook(authOptions));
  },
  { name: 'auth' },
);
