import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { buildApp } from './app';

// Minimal .env loader — parse KEY=VALUE and KEY="VALUE" lines
function loadEnvFile(): void {
  const envCandidates = [
    resolve(process.cwd(), '../../.env'),
    resolve(process.cwd(), '.env'),
  ];
  for (const envPath of envCandidates) {
    if (!existsSync(envPath)) continue;
    const envContent = readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex < 0) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      if (process.env[key]) continue; // don't override existing
      let value = trimmed.slice(eqIndex + 1).trim();
      // Remove surrounding quotes
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      // Replace escaped newlines with real newlines (for PEM keys)
      value = value.replace(/\\n/g, '\n');
      process.env[key] = value;
    }
    break; // use first found .env
  }
}

loadEnvFile();

async function start(): Promise<void> {
  const app = await buildApp();
  const port = Number(process.env['FORM_BUILDER_PORT'] ?? 3010);

  await app.listen({ port, host: '0.0.0.0' });
  app.log.info(`Form Builder service running on port ${port}`);
}

start().catch((err) => {
  console.error('Failed to start Form Builder service:', err);
  process.exit(1);
});
