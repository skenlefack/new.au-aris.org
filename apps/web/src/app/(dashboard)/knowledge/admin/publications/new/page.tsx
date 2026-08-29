'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Save, Send, Trash2, Paperclip, Upload, X, ImagePlus } from 'lucide-react';
import { TinyMCEEditor } from '@/components/knowledge/TinyMCEEditor';
import {
  usePublishableCategories,
  useCreatePublication,
  useSubmitPublication,
  useAllTags,
  type PublicationType,
  type Visibility,
  type KnowledgeCategory,
} from '@/lib/api/knowledge-hub-hooks';
import { uploadFile, detectAttachmentKind, type UploadedFile } from '@/lib/api/drive-client';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useTranslations } from '@/lib/i18n/translations';

const LOCALES = ['en', 'fr', 'pt', 'ar', 'es', 'sw'] as const;
type Locale = (typeof LOCALES)[number];

const PUBLICATION_TYPES: PublicationType[] = [
  'ARTICLE', 'NEWS', 'REPORT', 'BRIEF', 'GUIDELINE', 'EVENT',
  'ANNOUNCEMENT', 'FAQ', 'DATASET', 'INFOGRAPHIC', 'VIDEO',
];

const SUGGESTED_TAGS = [
  'animal health', 'livestock', 'fisheries', 'trade', 'governance',
  'surveillance', 'vaccination', 'AMR', 'transhumance', 'aquaculture',
  'food safety', 'One Health', 'climate adaptation', 'pastoralism',
  'disease outbreak', 'SPS', 'AfCFTA', 'biodiversity',
];

interface PendingAttachment extends UploadedFile {
  caption: string;
  kind: ReturnType<typeof detectAttachmentKind>;
}

export default function NewPublicationPage() {
  const t = useTranslations('knowledge');
  const router = useRouter();
  const userLocale = (useAuthStore((s) => s.user?.locale) ?? 'en').slice(0, 2) as Locale;

  const [activeLocale, setActiveLocale] = useState<Locale>(userLocale);
  const [title, setTitle] = useState<Record<Locale, string>>({ en: '', fr: '', pt: '', ar: '', es: '', sw: '' });
  const [summary, setSummary] = useState<Record<Locale, string>>({ en: '', fr: '', pt: '', ar: '', es: '', sw: '' });
  const [content, setContent] = useState<Record<Locale, string>>({ en: '', fr: '', pt: '', ar: '', es: '', sw: '' });
  const [categoryId, setCategoryId] = useState<string>('');
  const [type, setType] = useState<PublicationType>('ARTICLE');
  const [visibility, setVisibility] = useState<Visibility>('PUBLIC');
  const [tags, setTags] = useState('');
  const [authors, setAuthors] = useState('');
  const [coverImageId, setCoverImageId] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cats = usePublishableCategories();
  const createMut = useCreatePublication();
  const submitMut = useSubmitPublication();
  const allTags = useAllTags();

  const groupedCats = useMemo(() => {
    const groups: Record<string, KnowledgeCategory[]> = {};
    for (const cat of cats.data?.data ?? []) {
      const key = `${cat.scope}${cat.scopeTenantId ? ':' + cat.scopeTenantId : ''}`;
      (groups[key] ??= []).push(cat);
    }
    return groups;
  }, [cats.data]);

  const handleImageUpload = async (file: File): Promise<string> => {
    const uploaded = await uploadFile(file, { classification: 'PUBLIC' });
    return `/api/v1/drive/files/${uploaded.id}/download`;
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverUploading(true);
    setError(null);
    try {
      // Show local preview immediately (no auth needed)
      setCoverPreview(URL.createObjectURL(file));
      const uploaded = await uploadFile(file, { classification: 'PUBLIC' });
      setCoverImageId(uploaded.id);
    } catch (err) {
      setCoverPreview(null);
      setError(err instanceof Error ? err.message : t('pubErrCoverUpload'));
    } finally {
      setCoverUploading(false);
      e.target.value = '';
    }
  };

  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const f of files) {
        const uploaded = await uploadFile(f, { classification: 'PUBLIC' });
        setAttachments((prev) => [
          ...prev,
          { ...uploaded, caption: '', kind: detectAttachmentKind(f.type) },
        ]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('pubErrUpload'));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const buildPayload = () => ({
    categoryId,
    type,
    visibility,
    title: stripEmpty(title),
    summary: stripEmpty(summary),
    contentHtml: stripEmpty(content),
    authors: authors.split(',').map((s) => s.trim()).filter(Boolean),
    tags: tags.split(',').map((s) => s.trim()).filter(Boolean),
    ...(coverImageId && { coverImageId }),
    attachments: attachments.map((a, i) => ({
      fileId: a.id,
      caption: a.caption || undefined,
      kind: a.kind,
      sortOrder: i,
    })),
  });

  const handleSaveDraft = async () => {
    setError(null);
    if (!categoryId) return setError(t('pubErrCategory'));
    if (!title[userLocale]) return setError(t('pubErrTitle'));
    if (!content[userLocale]) return setError(t('pubErrContent'));
    try {
      const result = await createMut.mutateAsync(buildPayload());
      router.push(`/knowledge/admin/publications/${result.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('pubErrSave'));
    }
  };

  const handleSubmitForReview = async () => {
    setError(null);
    if (!categoryId) return setError(t('pubErrCategory'));
    if (!title[userLocale]) return setError(t('pubErrTitle'));
    if (!content[userLocale]) return setError(t('pubErrContent'));
    try {
      const result = await createMut.mutateAsync(buildPayload());
      await submitMut.mutateAsync(result.data.id);
      router.push('/knowledge/admin/mine');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('pubErrSubmit'));
    }
  };

  const currentTags = tags.split(',').map((s) => s.trim()).filter(Boolean);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('pubNewTitle')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('pubNewSubtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {LOCALES.map((loc) => (
            <button
              key={loc}
              onClick={() => setActiveLocale(loc)}
              className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                activeLocale === loc
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {loc.toUpperCase()}{title[loc] ? ' \u2713' : ''}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* ── Main content ── */}
        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-6">
            <input
              value={title[activeLocale]}
              onChange={(e) => setTitle({ ...title, [activeLocale]: e.target.value })}
              placeholder={`Publication title (${activeLocale.toUpperCase()})...`}
              dir={activeLocale === 'ar' ? 'rtl' : 'ltr'}
              className="w-full border-0 border-b bg-transparent px-0 py-2 text-2xl font-bold focus:outline-none focus:ring-0"
            />
            <textarea
              value={summary[activeLocale]}
              onChange={(e) => setSummary({ ...summary, [activeLocale]: e.target.value })}
              placeholder={`Short summary (${activeLocale.toUpperCase()})...`}
              dir={activeLocale === 'ar' ? 'rtl' : 'ltr'}
              rows={2}
              className="mt-3 w-full resize-none border-0 border-b bg-transparent px-0 py-2 text-base text-muted-foreground focus:outline-none focus:ring-0"
            />
          </div>

          <div className="rounded-lg border bg-card p-4">
            <TinyMCEEditor
              value={content[activeLocale]}
              onChange={(html) => setContent({ ...content, [activeLocale]: html })}
              language={activeLocale}
              onImageUpload={handleImageUpload}
              height={800}
            />
          </div>
        </div>

        {/* ── Sidebar settings ── */}
        <div className="space-y-4">
          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleSaveDraft}
              disabled={createMut.isPending}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
            >
              <Save className="h-4 w-4" /> {t('pubSaveDraft')}
            </button>
            <button
              onClick={handleSubmitForReview}
              disabled={createMut.isPending || submitMut.isPending}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Send className="h-4 w-4" /> {t('pubSubmit')}
            </button>
          </div>

          {/* Featured image */}
          <div className="rounded-lg border bg-card p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <ImagePlus className="mr-1 inline h-3.5 w-3.5" /> {t('pubFeaturedImage')}
            </h2>
            {coverPreview ? (
              <div className="group relative">
                <div className="relative aspect-video w-full overflow-hidden rounded-lg border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={coverPreview}
                    alt="Cover preview"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="mt-2 flex gap-2">
                  <label className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent">
                    <Upload className="h-3 w-3" /> {t('pubReplace')}
                    <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} disabled={coverUploading} />
                  </label>
                  <button
                    onClick={() => { setCoverImageId(null); setCoverPreview(null); }}
                    className="inline-flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-3 w-3" /> {t('pubRemove')}
                  </button>
                </div>
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50/50 py-8 transition-colors hover:border-emerald-400 hover:bg-emerald-50/50 dark:border-gray-600 dark:bg-gray-800/50 dark:hover:border-emerald-600 dark:hover:bg-emerald-900/20">
                {coverUploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                    <span className="text-xs text-muted-foreground">{t('pubUploading')}</span>
                  </div>
                ) : (
                  <>
                    <ImagePlus className="mb-2 h-10 w-10 text-gray-400" strokeWidth={1.2} />
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{t('pubClickToUpload')}</span>
                    <span className="mt-1 text-xs text-muted-foreground">{t('pubImageHint')}</span>
                  </>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} disabled={coverUploading} />
              </label>
            )}
          </div>

          {/* Settings card */}
          <div className="rounded-lg border bg-card p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t('pubSettings')}</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium">{t('pubCategory')}</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="">{t('pubPickCategory')}</option>
                  {Object.entries(groupedCats).map(([groupKey, list]) => (
                    <optgroup key={groupKey} label={groupKey}>
                      {list.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nameEn} ({c.scope})
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                {cats.data?.data?.length === 0 && (
                  <p className="mt-1 text-xs text-amber-600">
                    {t('pubNoCategoriesHint')}{' '}
                    <Link href="/knowledge/admin/categories" className="underline">Categories</Link>.
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium">{t('pubType')}</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as PublicationType)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                >
                  {PUBLICATION_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium">{t('pubVisibility')}</label>
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as Visibility)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="PUBLIC">{t('pubVisibilityPublic')}</option>
                  <option value="PRIVATE">{t('pubVisibilityPrivate')}</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium">{t('pubAuthors')}</label>
                <input
                  value={authors}
                  onChange={(e) => setAuthors(e.target.value)}
                  placeholder={t('pubAuthorsPlaceholder')}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Tags card */}
          <div className="rounded-lg border bg-card p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t('pubTags')}</h2>
            <div className="flex flex-wrap gap-1.5 rounded-md border p-2">
              {currentTags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                  {tag}
                  <button
                    type="button"
                    onClick={() => setTags(currentTags.filter((t) => t !== tag).join(', '))}
                    className="text-emerald-600 hover:text-emerald-900 dark:text-emerald-400"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                value={tags.endsWith(',') || tags === '' ? '' : tags.split(',').pop()?.trim() ?? ''}
                onChange={(e) => {
                  const existing = currentTags;
                  if (tags === '' || tags.endsWith(',') || tags.endsWith(', ')) {
                    setTags(existing.length > 0 ? existing.join(', ') + ', ' + e.target.value : e.target.value);
                  } else {
                    setTags([...existing.slice(0, -1), e.target.value].join(', '));
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    const val = tags.split(',').pop()?.trim() ?? '';
                    if (val) setTags(tags.endsWith(',') ? tags + ' ' : tags + ', ');
                  }
                }}
                placeholder={currentTags.length ? t('pubAddMore') : t('pubTypeOrPick')}
                className="min-w-[80px] flex-1 bg-transparent text-sm outline-none"
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {(allTags.data?.data ?? SUGGESTED_TAGS)
                .filter((t) => !currentTags.map((s) => s.toLowerCase()).includes(t.toLowerCase()))
                .slice(0, 12)
                .map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      if (!currentTags.map((s) => s.toLowerCase()).includes(t.toLowerCase())) {
                        setTags([...currentTags, t].join(', '));
                      }
                    }}
                    className="rounded-full border border-dashed border-gray-300 px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-900/30"
                  >
                    + {t}
                  </button>
                ))}
            </div>
          </div>

          {/* Attachments card */}
          <div className="rounded-lg border bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                <Paperclip className="mr-1 inline h-3 w-3" /> {t('pubAttachments')} ({attachments.length})
              </h2>
              <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent">
                <Upload className="h-3 w-3" />
                {uploading ? t('pubUploading') : t('pubUpload')}
                <input type="file" multiple className="hidden" onChange={handleAttachmentUpload} disabled={uploading} />
              </label>
            </div>
            {attachments.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t('pubNoAttachments')}</p>
            ) : (
              <ul className="space-y-2">
                {attachments.map((a, i) => (
                  <li key={a.id} className="rounded-md border p-2 text-xs">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="rounded bg-muted px-1.5 py-0.5 font-medium">{a.kind}</span>
                      <button
                        onClick={() => setAttachments(attachments.filter((_, j) => j !== i))}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="truncate">{a.filename}</div>
                    <input
                      value={a.caption}
                      onChange={(e) => {
                        const copy = [...attachments];
                        copy[i] = { ...a, caption: e.target.value };
                        setAttachments(copy);
                      }}
                      placeholder="Caption..."
                      className="mt-1 w-full rounded border px-2 py-1 text-xs"
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function stripEmpty(obj: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v && v.trim()) out[k] = v;
  }
  return out;
}
