import type { PrismaClient } from '@prisma/client';
import type { Client as OpenSearchClient } from '@opensearch-project/opensearch';

const LEXICAL_THRESHOLD = parseFloat(process.env['INGEST_LEXICAL_THRESHOLD'] ?? '0.90');
const VECTOR_THRESHOLD = parseFloat(process.env['INGEST_VECTOR_THRESHOLD'] ?? '0.80');
const LLM_THRESHOLD = parseFloat(process.env['INGEST_LLM_THRESHOLD'] ?? '0.70');
const OLLAMA_URL = process.env['OLLAMA_URL'] ?? 'http://10.202.101.142:11434';
const LLM_MODEL = process.env['INGEST_LLM_MODEL'] ?? 'qwen2.5:32b';
const LLM_TIMEOUT = parseInt(process.env['INGEST_LLM_TIMEOUT_MS'] ?? '600000', 10);
const ML_EMBEDDINGS_URL = process.env['ML_EMBEDDINGS_URL'] ?? 'http://10.202.101.142:8000/api/embeddings';
const FORM_SIGNATURES_INDEX = 'aris-form-signatures';

export interface AnnotationResult {
  concept: string | null;
  confidence: number;
  method: 'LEXICAL' | 'VECTOR' | 'LLM' | 'NONE';
}

/**
 * Multilingual alias dictionary for ARIS field concepts.
 * Used for level-1 lexical matching.
 */
const CONCEPT_ALIASES: Record<string, string[]> = {
  species: ['species', 'espece', 'espèce', 'especie', 'نوع', 'animal', 'type_animal', 'livestock_type'],
  disease: ['disease', 'maladie', 'doença', 'doenca', 'مرض', 'pathology', 'pathologie', 'diagnosis'],
  country: ['country', 'pays', 'pais', 'país', 'بلد', 'nation', 'country_code', 'iso_code'],
  region: ['region', 'région', 'regiao', 'منطقة', 'admin1', 'province', 'state', 'county'],
  district: ['district', 'distrito', 'حي', 'admin2', 'zone', 'area', 'locality'],
  date: ['date', 'fecha', 'تاريخ', 'observation_date', 'report_date', 'event_date', 'date_observation'],
  latitude: ['latitude', 'lat', 'خط_العرض', 'gps_lat', 'y_coord'],
  longitude: ['longitude', 'lng', 'lon', 'خط_الطول', 'gps_lng', 'x_coord'],
  cases: ['cases', 'cas', 'casos', 'حالات', 'nb_cases', 'number_cases', 'affected', 'morbidity'],
  deaths: ['deaths', 'deces', 'décès', 'muertes', 'mortes', 'وفيات', 'mortality', 'nb_deaths'],
  vaccinated: ['vaccinated', 'vaccinés', 'vacinados', 'ملقح', 'nb_vaccinated', 'doses'],
  population: ['population', 'efectivo', 'عدد_السكان', 'headcount', 'herd_size', 'flock_size', 'total_animals'],
  production: ['production', 'produccion', 'إنتاج', 'yield', 'output', 'volume'],
  weight: ['weight', 'poids', 'peso', 'وزن', 'mass', 'kg', 'tonnes'],
  age: ['age', 'âge', 'edad', 'idade', 'عمر', 'age_group', 'classe_age'],
  sex: ['sex', 'sexe', 'sexo', 'جنس', 'gender', 'male_female'],
  breed: ['breed', 'race', 'raza', 'raça', 'سلالة', 'breed_type'],
  laboratory: ['laboratory', 'laboratoire', 'laboratorio', 'مختبر', 'lab', 'lab_name', 'lab_code'],
  sample: ['sample', 'echantillon', 'échantillon', 'muestra', 'amostra', 'عينة', 'sample_type'],
  result: ['result', 'resultat', 'résultat', 'resultado', 'نتيجة', 'test_result', 'outcome'],
  status: ['status', 'statut', 'estado', 'حالة', 'state', 'condition'],
  name: ['name', 'nom', 'nombre', 'اسم', 'designation', 'label', 'title'],
  code: ['code', 'codigo', 'código', 'رمز', 'identifier', 'id', 'reference'],
  description: ['description', 'وصف', 'descripcion', 'descricao'],
  quantity: ['quantity', 'quantite', 'quantité', 'cantidad', 'كمية', 'amount', 'count', 'number', 'nb', 'nombre'],
  price: ['price', 'prix', 'precio', 'preço', 'سعر', 'cost', 'value', 'montant'],
  unit: ['unit', 'unite', 'unité', 'unidad', 'وحدة', 'uom', 'measure'],
};

/**
 * Level 1: Lexical annotation using fuzzy matching against the alias dictionary.
 */
export function annotateViaLexical(normalizedName: string): AnnotationResult {
  // Exact match first
  for (const [concept, aliases] of Object.entries(CONCEPT_ALIASES)) {
    if (aliases.includes(normalizedName)) {
      return { concept, confidence: 1.0, method: 'LEXICAL' };
    }
  }

  // Fuzzy: substring containment
  for (const [concept, aliases] of Object.entries(CONCEPT_ALIASES)) {
    for (const alias of aliases) {
      if (normalizedName.includes(alias) || alias.includes(normalizedName)) {
        const sim = 2 * Math.min(normalizedName.length, alias.length) / (normalizedName.length + alias.length);
        if (sim >= LEXICAL_THRESHOLD) {
          return { concept, confidence: sim, method: 'LEXICAL' };
        }
      }
    }
  }

  // Levenshtein on short names
  if (normalizedName.length <= 20) {
    let bestConcept = '';
    let bestSim = 0;
    for (const [concept, aliases] of Object.entries(CONCEPT_ALIASES)) {
      for (const alias of aliases) {
        const sim = levenshteinSimilarity(normalizedName, alias);
        if (sim > bestSim) {
          bestSim = sim;
          bestConcept = concept;
        }
      }
    }
    if (bestSim >= LEXICAL_THRESHOLD) {
      return { concept: bestConcept, confidence: bestSim, method: 'LEXICAL' };
    }
  }

  return { concept: null, confidence: 0, method: 'NONE' };
}

/**
 * Level 2: Vector annotation using OpenSearch kNN on form field embeddings.
 * R2: Pre-filtered by tenantId + domainCode before kNN search.
 */
export async function annotateViaVector(
  columnName: string,
  sampleValues: string[],
  tenantId: string,
  domainCode: string,
  opensearch: OpenSearchClient,
): Promise<AnnotationResult> {
  try {
    // Get embedding for the column (name + sample values)
    const textToEmbed = `${columnName}: ${sampleValues.slice(0, 3).join(', ')}`;
    const embedding = await getEmbedding(textToEmbed);
    if (!embedding) return { concept: null, confidence: 0, method: 'NONE' };

    // R2: kNN search pre-filtered by tenant + domain
    const response = await opensearch.search({
      index: FORM_SIGNATURES_INDEX,
      body: {
        size: 3,
        query: {
          bool: {
            must: [{ knn: { embedding_vector: { vector: embedding, k: 3 } } }],
            filter: [
              { term: { tenant_id: tenantId } },
              { term: { domain_code: domainCode } },
            ],
          },
        },
      },
    });

    const hits = (response.body?.hits?.hits ?? []) as Array<{ _score: number; _source: Record<string, unknown> }>;
    if (hits.length > 0 && hits[0]._score >= VECTOR_THRESHOLD) {
      const fieldCode = hits[0]._source.field_code as string;
      return { concept: fieldCode, confidence: hits[0]._score, method: 'VECTOR' };
    }
  } catch {
    // OpenSearch unavailable → fall through to LLM or NONE
  }

  return { concept: null, confidence: 0, method: 'NONE' };
}

/**
 * Level 3: LLM annotation via Ollama (Qwen 2.5-32B).
 * R6: timeout strict, fallback déterministe, sortie JSON contrainte.
 * Called only for residual columns (<15% target).
 */
export async function annotateViaLlm(
  columnName: string,
  sampleValues: string[],
  availableConcepts: string[],
): Promise<AnnotationResult> {
  try {
    const prompt = `You are a data mapping assistant. Given a column from a data file, identify which concept it maps to.

Column name: "${columnName}"
Sample values: ${JSON.stringify(sampleValues.slice(0, 5))}
Available concepts: ${JSON.stringify(availableConcepts)}

Respond with ONLY valid JSON: {"concept": "chosen_concept", "confidence": 0.0-1.0}
If no concept matches, respond: {"concept": null, "confidence": 0}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT);

    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: LLM_MODEL,
        prompt,
        format: 'json',
        stream: false,
        options: { temperature: 0, num_predict: 100 },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) return { concept: null, confidence: 0, method: 'NONE' };

    const body = await res.json() as { response?: string };
    const parsed = JSON.parse(body.response ?? '{}') as { concept?: string; confidence?: number };

    if (parsed.concept && availableConcepts.includes(parsed.concept) && (parsed.confidence ?? 0) >= LLM_THRESHOLD) {
      return { concept: parsed.concept, confidence: parsed.confidence ?? LLM_THRESHOLD, method: 'LLM' };
    }
  } catch {
    // R6: LLM unavailable → fallback to NONE (deterministic)
  }

  return { concept: null, confidence: 0, method: 'NONE' };
}

/**
 * Full cascade: lexical → vector → LLM.
 * Stops as soon as one level reaches its confidence threshold.
 */
export async function annotateCascade(
  normalizedName: string,
  sampleValues: string[],
  tenantId: string,
  domainCode: string,
  availableConcepts: string[],
  opensearch: OpenSearchClient,
): Promise<AnnotationResult> {
  // Level 1: Lexical
  const lexResult = annotateViaLexical(normalizedName);
  if (lexResult.concept) return lexResult;

  // Level 2: Vector (OpenSearch kNN)
  const vecResult = await annotateViaVector(normalizedName, sampleValues, tenantId, domainCode, opensearch);
  if (vecResult.concept) return vecResult;

  // Level 3: LLM (Ollama) — only if concepts available
  if (availableConcepts.length > 0) {
    return annotateViaLlm(normalizedName, sampleValues, availableConcepts);
  }

  return { concept: null, confidence: 0, method: 'NONE' };
}

// ── Helpers ──

async function getEmbedding(text: string): Promise<number[] | null> {
  try {
    const res = await fetch(ML_EMBEDDINGS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, model: 'bge-m3' }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;
    const body = await res.json() as { embedding?: number[] };
    return body.embedding ?? null;
  } catch {
    return null;
  }
}

function levenshteinSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  const maxLen = Math.max(a.length, b.length);
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return 1 - dp[m][n] / maxLen;
}
