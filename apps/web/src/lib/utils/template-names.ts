/**
 * Multilingual template name mapping.
 * Form template names are stored as plain strings in the DB (varchar).
 * This map provides translations so the UI can display them in the user's locale.
 */

const TEMPLATE_NAMES: Record<string, Record<string, string>> = {
  // ── Fisheries & Aquaculture (AFAData) ──
  'Capture Fisheries Report': { fr: 'Rapport de pêche de capture', pt: 'Relatório de pesca de captura', ar: 'تقرير صيد الأسماك' },
  'Aquaculture Production Report': { fr: 'Rapport de production aquacole', pt: 'Relatório de produção aquícola', ar: 'تقرير الإنتاج المائي' },
  'Aquaculture Farm Registration': { fr: 'Enregistrement de ferme aquacole', pt: 'Registo de fazenda aquícola', ar: 'تسجيل مزرعة مائية' },
  'Aquaculture Farm Report': { fr: 'Rapport de ferme aquacole', pt: 'Relatório de fazenda aquícola', ar: 'تقرير مزرعة مائية' },
  'Fish Trade Report': { fr: 'Rapport de commerce de poisson', pt: 'Relatório de comércio de peixe', ar: 'تقرير تجارة الأسماك' },
  'Fishing Vessel Registration': { fr: 'Enregistrement de navire de pêche', pt: 'Registo de embarcação de pesca', ar: 'تسجيل سفينة صيد' },
  'Fishing Effort Report': { fr: 'Rapport d\'effort de pêche', pt: 'Relatório de esforço de pesca', ar: 'تقرير جهد الصيد' },
  'Fishing Effort Quarterly': { fr: 'Effort de pêche trimestriel', pt: 'Esforço de pesca trimestral', ar: 'جهد الصيد الفصلي' },
  'Monthly Captures Report': { fr: 'Rapport mensuel des captures', pt: 'Relatório mensal de capturas', ar: 'تقرير الصيد الشهري' },
  'Vessel Registry': { fr: 'Registre des navires', pt: 'Registo de embarcações', ar: 'سجل السفن' },
  'Fisheries & Aquaculture Event Alert': { fr: 'Alerte événement pêche et aquaculture', pt: 'Alerta de evento de pesca e aquicultura', ar: 'تنبيه أحداث الصيد والاستزراع' },

  // ── Animal Health ──
  'Animal Health Event Alert': { fr: 'Alerte événement santé animale', pt: 'Alerta de evento de saúde animal', ar: 'تنبيه أحداث الصحة الحيوانية' },
  'Aquatic Animal Health Event Report': { fr: 'Rapport d\'événement santé animale aquatique', pt: 'Relatório de evento de saúde animal aquática', ar: 'تقرير أحداث الصحة الحيوانية المائية' },
};

/**
 * Resolve template name to the user's locale.
 * Falls back to the original English name if no translation exists.
 */
export function resolveTemplateName(name: string, locale: string): string {
  if (!name || locale === 'en') return name;
  return TEMPLATE_NAMES[name]?.[locale] ?? name;
}
