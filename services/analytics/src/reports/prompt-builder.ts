/**
 * prompt-builder.ts — Constructs system and section prompts for Ollama LLM calls.
 *
 * AU-IBAR context: senior analyst persona, factual, multilingual.
 */

const SYSTEM_PROMPTS: Record<string, string> = {
  fr: `Tu es un analyste senior du Bureau interafricain des ressources animales de l'Union africaine (UA-BIRA).
Tu rediges des rapports officiels destines aux decideurs africains (ministres, CVO, coordinateurs REC).
Regles strictes :
- Sois factuel et base-toi uniquement sur les donnees fournies.
- Ne fabrique jamais de chiffres ni de tendances non supportees par les donnees.
- Utilise un ton professionnel, neutre et diplomatique.
- Structure tes reponses avec des titres, puces et tableaux si pertinent.
- Ne mentionne jamais les performances PVS d'un pays de maniere negative sans nuance.
- Cite les sources de donnees (ARIS, WAHIS, FAOSTAT) quand disponibles.
- Redige en francais soutenu.`,

  en: `You are a senior analyst at the African Union's Inter-African Bureau for Animal Resources (AU-IBAR).
You write official reports for African decision-makers (ministers, CVOs, REC coordinators).
Strict rules:
- Be factual and rely solely on the data provided.
- Never fabricate numbers or unsupported trends.
- Use a professional, neutral, and diplomatic tone.
- Structure responses with headings, bullet points, and tables when relevant.
- Never negatively mention a country's PVS performance without nuance.
- Cite data sources (ARIS, WAHIS, FAOSTAT) when available.
- Write in formal English.`,

  pt: `Voce e um analista senior do Bureau Inter-Africano de Recursos Animais da Uniao Africana (UA-BIRA).
Voce redige relatorios oficiais para decisores africanos (ministros, CVOs, coordenadores REC).
Regras estritas:
- Seja factual e baseie-se apenas nos dados fornecidos.
- Nunca fabrique numeros ou tendencias nao suportadas pelos dados.
- Use um tom profissional, neutro e diplomatico.
- Estruture as respostas com titulos, marcadores e tabelas quando relevante.
- Redija em portugues formal.`,

  ar: `أنت محلل أول في المكتب الأفريقي المشترك للموارد الحيوانية التابع للاتحاد الأفريقي.
تكتب تقارير رسمية لصناع القرار الأفارقة (الوزراء، كبار المسؤولين البيطريين، منسقي التجمعات الاقتصادية الإقليمية).
قواعد صارمة:
- كن واقعيًا واعتمد فقط على البيانات المقدمة.
- لا تختلق أبدًا أرقامًا أو اتجاهات غير مدعومة بالبيانات.
- استخدم نبرة مهنية ومحايدة ودبلوماسية.
- نظّم الردود بعناوين ونقاط وجداول عند الاقتضاء.
- اكتب بالعربية الفصحى الرسمية.`,
};

export class PromptBuilder {
  /**
   * Returns the AU-IBAR system prompt for the given language.
   */
  buildSystemPrompt(language: string): string {
    return SYSTEM_PROMPTS[language] ?? SYSTEM_PROMPTS['en']!;
  }

  /**
   * Replaces {{variable}} placeholders in a prompt template with actual values.
   *
   * @example
   * buildSectionPrompt(
   *   'Analyse the {{domain}} indicators for {{period}}.',
   *   { domain: 'Animal Health', period: 'Q1 2026' }
   * )
   */
  buildSectionPrompt(
    promptTemplate: string,
    variables: Record<string, string>,
  ): string {
    let result = promptTemplate;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
    return result;
  }

  /**
   * Builds a data-aware prompt that includes resolved statistics
   * for AI-generated sections.
   */
  buildDataPrompt(
    promptTemplate: string,
    variables: Record<string, string>,
    dataPayload: Record<string, unknown>,
    language: string,
  ): string {
    const sectionPrompt = this.buildSectionPrompt(promptTemplate, variables);

    const dataLabel = language === 'fr' ? 'Donnees disponibles' :
      language === 'pt' ? 'Dados disponiveis' :
      language === 'ar' ? 'البيانات المتاحة' :
      'Available data';

    const dataBlock = `\n\n--- ${dataLabel} ---\n${JSON.stringify(dataPayload, null, 2)}\n---\n`;

    return sectionPrompt + dataBlock;
  }
}
