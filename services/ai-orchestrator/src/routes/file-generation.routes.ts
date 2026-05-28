/**
 * ARIS 4.0 — File-based AI Generation Routes
 * Accepts a fileId, downloads the file, parses its content,
 * enriches the prompt with the data, and generates AI suggestions.
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { AuthenticatedUser } from '@aris/auth-middleware';

const MAX_ROWS_CSV = 100;
const MAX_TEXT_LENGTH = 8000;

interface SuggestWithFileBody {
  prompt: string;
  fileId: string;
  type: 'form' | 'campaign' | 'indicator' | 'dashboard';
  context?: Record<string, unknown>;
}

function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + `\n\n[... truncated, ${text.length - maxLen} chars omitted]`;
}

function parseCSV(buffer: Buffer): string {
  const text = buffer.toString('utf-8');
  const lines = text.split('\n').filter(l => l.trim());
  const header = lines[0] || '';
  const dataLines = lines.slice(1, MAX_ROWS_CSV + 1);
  const summary = `CSV Data (${lines.length - 1} rows, showing first ${dataLines.length}):\n${header}\n${dataLines.join('\n')}`;
  if (lines.length - 1 > MAX_ROWS_CSV) {
    return summary + `\n\n[... ${lines.length - 1 - MAX_ROWS_CSV} more rows omitted]`;
  }
  return summary;
}

async function parseExcel(buffer: Buffer): Promise<string> {
  try {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const firstSheet = workbook.SheetNames[0];
    if (!firstSheet) return 'Empty Excel file';
    const sheet = workbook.Sheets[firstSheet];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    return parseCSV(Buffer.from(csv, 'utf-8'));
  } catch {
    return 'Failed to parse Excel file';
  }
}

async function parsePDF(buffer: Buffer): Promise<string> {
  try {
    const pdfParse = (await import('pdf-parse')).default;
    const data = await pdfParse(buffer);
    return truncateText(`PDF Content (${data.numpages} pages):\n\n${data.text}`, MAX_TEXT_LENGTH);
  } catch {
    return 'Failed to parse PDF file';
  }
}

function parseImage(buffer: Buffer, mimeType: string): string {
  const base64 = buffer.toString('base64');
  return `[Image attached: ${mimeType}, ${Math.round(buffer.length / 1024)}KB]\n\nNote: This is an image file. Describe what you see based on the context provided.`;
}

async function parseFileContent(buffer: Buffer, mimeType: string, filename: string): Promise<string> {
  const lower = (mimeType + filename).toLowerCase();

  if (lower.includes('csv') || lower.includes('tsv') || lower.endsWith('.csv') || lower.endsWith('.tsv')) {
    return parseCSV(buffer);
  }
  if (lower.includes('spreadsheet') || lower.includes('excel') || lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    return parseExcel(buffer);
  }
  if (lower.includes('pdf') || lower.endsWith('.pdf')) {
    return parsePDF(buffer);
  }
  if (lower.includes('image/') || lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
    return parseImage(buffer, mimeType);
  }
  if (lower.includes('text/') || lower.endsWith('.txt') || lower.endsWith('.json')) {
    return truncateText(`File Content:\n\n${buffer.toString('utf-8')}`, MAX_TEXT_LENGTH);
  }

  return `Unsupported file type: ${mimeType}. File: ${filename} (${Math.round(buffer.length / 1024)}KB)`;
}

export async function registerFileGenerationRoutes(app: FastifyInstance): Promise<void> {

  app.post('/api/v1/ai/generation/suggest-with-file', {
    preHandler: [app.authHookFn, app.rateLimitHook],
  }, async (request: FastifyRequest<{ Body: SuggestWithFileBody }>, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const { prompt, fileId, type, context } = request.body;

    if (!prompt?.trim()) {
      return reply.code(400).send({ statusCode: 400, message: 'Prompt is required' });
    }
    if (!fileId) {
      return reply.code(400).send({ statusCode: 400, message: 'fileId is required' });
    }

    const startMs = Date.now();
    const token = request.headers.authorization?.replace('Bearer ', '') || '';

    try {
      // 1. Get file metadata
      const metadata = await app.driveClient.getFileMetadata(fileId, token);
      request.log.info({ fileId, filename: metadata.originalFilename, mimeType: metadata.mimeType }, 'Downloading file for AI generation');

      // 2. Download file content
      const buffer = await app.driveClient.downloadFile(fileId, token);

      // 3. Parse file content
      const fileContent = await parseFileContent(buffer, metadata.mimeType, metadata.originalFilename);

      // 4. Build enriched prompt
      const enrichedPrompt = `${prompt}\n\n--- Attached File: ${metadata.originalFilename} ---\n${fileContent}\n--- End of File ---`;

      // 5. Build system prompt based on type
      const systemPrompts: Record<string, string> = {
        form: 'You are an ARIS form designer. Based on the user prompt and attached file data, generate a JSON Schema form structure with sections and fields. Return valid JSON.',
        campaign: 'You are an ARIS campaign planner. Based on the user prompt and attached data, generate a campaign structure with dates, targets, and forms. Return valid JSON.',
        indicator: 'You are an ARIS KPI designer. Based on the user prompt and attached data, generate an indicator definition with formula, thresholds, and data sources. Return valid JSON.',
        dashboard: 'You are an ARIS dashboard builder. Based on the user prompt and attached data, generate a dashboard layout with widgets. Return valid JSON.',
      };

      const model = type === 'form' || type === 'dashboard' ? 'phi4:14b' : 'qwen2.5:32b';

      // 6. Generate with Ollama
      const result = await app.ollamaClient.generate({
        model,
        prompt: enrichedPrompt,
        system: systemPrompts[type] || systemPrompts.form,
        temperature: 0.3,
        maxTokens: 2048,
        format: 'json',
      });

      const durationMs = Date.now() - startMs;

      // 7. Save draft
      let parsedOutput: Record<string, unknown>;
      try {
        parsedOutput = JSON.parse(result.output);
      } catch {
        parsedOutput = { raw: result.output };
      }

      const draft = await app.prisma.aiGenerationDraft.create({
        data: {
          userId: user.userId,
          type: type.toUpperCase() as 'FORM' | 'CAMPAIGN' | 'INDICATOR' | 'DASHBOARD',
          prompt: enrichedPrompt.slice(0, 5000),
          output: parsedOutput as any,
          status: 'DRAFT',
        },
      });

      // 8. Log usage
      await app.usageLogger.log({
        userId: user.userId,
        endpoint: '/ai/generation/suggest-with-file',
        model,
        tokensInput: result.tokensInput || 0,
        tokensOutput: result.tokensOutput || 0,
        durationMs,
        status: 'success',
      });

      return reply.send({
        data: {
          id: draft.id,
          type,
          prompt: prompt.slice(0, 200),
          output: parsedOutput,
          status: 'DRAFT',
          model,
          durationMs,
          fileInfo: {
            filename: metadata.originalFilename,
            mimeType: metadata.mimeType,
            size: metadata.size,
          },
        },
      });

    } catch (err) {
      const durationMs = Date.now() - startMs;
      request.log.error(err, 'File-based generation failed');

      await app.usageLogger.log({
        userId: user.userId,
        endpoint: '/ai/generation/suggest-with-file',
        model: 'unknown',
        tokensInput: 0,
        tokensOutput: 0,
        durationMs,
        status: 'failed',
      });

      const message = err instanceof Error ? err.message : 'File-based generation failed';
      return reply.code(500).send({ statusCode: 500, message });
    }
  });
}
