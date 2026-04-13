'use client';

// Full-screen publication editor — uses the entire viewport (no dashboard
// sidebar) so TinyMCE has maximum room to work. The form is split into a
// fixed top toolbar (locale tabs + actions) and a scrollable content body.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Save, Send, Trash2, Paperclip, Upload, ArrowLeft, Settings as SettingsIcon, X } from 'lucide-react';
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

const LOCALES = ['en', 'fr', 'pt', 'ar'] as const;
type Locale = (typeof LOCALES)[number];

const PUBLICATION_TYPES: PublicationType[] = [
  'ARTICLE', 'NEWS', 'REPORT', 'BRIEF', 'GUIDELINE', 'EVENT',
  'ANNOUNCEMENT', 'FAQ', 'DATASET', 'INFOGRAPHIC', 'VIDEO',
];

/** Default tag suggestions until enough tags exist in the database */
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

export default function NewPublicationFullScreenPage() {
  const router = useRouter();
  const userLocale = (useAuthStore((s) => s.user?.locale) ?? 'en').slice(0, 2) as Locale;

  const [activeLocale, setActiveLocale] = useState<Locale>(userLocale);
  const [title, setTitle] = useState<Record<Locale, string>>({ en: '', fr: '', pt: '', ar: '' });
  const [summary, setSummary] = useState<Record<Locale, string>>({ en: '', fr: '', pt: '', ar: '' });
  const [content, setContent] = useState<Record<Locale, string>>({ en: '', fr: '', pt: '', ar: '' });
  const [categoryId, setCategoryId] = useState<string>('');
  const [type, setType] = useState<PublicationType>('ARTICLE');
  const [visibility, setVisibility] = useState<Visibility>('PUBLIC');
  const [tags, setTags] = useState('');
  const [authors, setAuthors] = useState('');
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

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
      setError(err instanceof Error ? err.message : 'Upload failed');
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
    attachments: attachments.map((a, i) => ({
      fileId: a.id,
      caption: a.caption || undefined,
      kind: a.kind,
      sortOrder: i,
    })),
  });

  const handleSaveDraft = async () => {
    setError(null);
    if (!categoryId) return setError('Please pick a category');
    if (!title[userLocale]) return setError('Title is required');
    if (!content[userLocale]) return setError('Content is required');
    try {
      const result = await createMut.mutateAsync(buildPayload());
      router.push(`/knowledge/admin/publications/${result.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  const handleSubmitForReview = async () => {
    setError(null);
    if (!categoryId) return setError('Please pick a category');
    if (!title[userLocale]) return setError('Title is required');
    if (!content[userLocale]) return setError('Content is required');
    try {
      const result = await createMut.mutateAsync(buildPayload());
      await submitMut.mutateAsync(result.data.id);
      router.push('/knowledge/admin/mine');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit');
    }
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b bg-card px-6 py-3 shadow-sm">
        <div className="flex items-center gap-4">
          <Link
            href="/knowledge/admin"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Knowledge Hub
          </Link>
          <span className="h-5 w-px bg-border" />
          <h1 className="text-lg font-semibold">New publication</h1>
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
              {loc.toUpperCase()}{title[loc] ? ' ✓' : ''}
            </button>
          ))}
          <span className="mx-2 h-5 w-px bg-border" />
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
            title="Toggle settings panel"
          >
            <SettingsIcon className="h-4 w-4" />
          </button>
          <button
            onClick={handleSaveDraft}
            disabled={createMut.isPending}
            className="inline-flex items-center gap-2 rounded-md border px-4 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
          >
            <Save className="h-4 w-4" /> Save draft
          </button>
          <button
            onClick={handleSubmitForReview}
            disabled={createMut.isPending || submitMut.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Send className="h-4 w-4" /> Submit for review
          </button>
        </div>
      </header>

      {error && (
        <div className="border-b border-red-200 bg-red-50 px-6 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto px-8 py-6">
          <div className="mx-auto w-full max-w-5xl space-y-4">
            <input
              value={title[activeLocale]}
              onChange={(e) => setTitle({ ...title, [activeLocale]: e.target.value })}
              placeholder={`Publication title (${activeLocale.toUpperCase()})…`}
              dir={activeLocale === 'ar' ? 'rtl' : 'ltr'}
              className="w-full border-0 border-b bg-transparent px-0 py-2 text-3xl font-bold focus:outline-none focus:ring-0"
            />
            <textarea
              value={summary[activeLocale]}
              onChange={(e) => setSummary({ ...summary, [activeLocale]: e.target.value })}
              placeholder={`Short summary (${activeLocale.toUpperCase()})…`}
              dir={activeLocale === 'ar' ? 'rtl' : 'ltr'}
              rows={2}
              className="w-full resize-none border-0 border-b bg-transparent px-0 py-2 text-lg text-muted-foreground focus:outline-none focus:ring-0"
            />
            <div>
              <TinyMCEEditor
                value={content[activeLocale]}
                onChange={(html) => setContent({ ...content, [activeLocale]: html })}
                language={activeLocale}
                onImageUpload={handleImageUpload}
                height={650}
              />
            </div>
          </div>
        </main>

        {sidebarOpen && (
          <aside className="w-96 shrink-0 overflow-y-auto border-l bg-card p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Publication settings</h2>

            <section className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium">Category</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="">— pick a category —</option>
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
                    No publishable categories. Propose one in{' '}
                    <Link href="/knowledge/admin/categories" className="underline">Categories</Link>.
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium">Type</label>
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
                <label className="mb-1 block text-xs font-medium">Visibility</label>
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as Visibility)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="PUBLIC">Public (no login required)</option>
                  <option value="PRIVATE">Private (authenticated users only)</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium">Authors</label>
                <input
                  value={authors}
                  onChange={(e) => setAuthors(e.target.value)}
                  placeholder="Jane Doe, John Smith"
                  className="w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium">Tags</label>
                <div className="flex flex-wrap gap-1.5 rounded-md border p-2">
                  {tags.split(',').map((s) => s.trim()).filter(Boolean).map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                      {tag}
                      <button
                        type="button"
                        onClick={() => {
                          const list = tags.split(',').map((s) => s.trim()).filter(Boolean).filter((t) => t !== tag);
                          setTags(list.join(', '));
                        }}
                        className="text-emerald-600 hover:text-emerald-900"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  <input
                    value={tags.endsWith(',') || tags === '' ? '' : tags.split(',').pop()?.trim() ?? ''}
                    onChange={(e) => {
                      const existing = tags.split(',').map((s) => s.trim()).filter(Boolean);
                      // If user is typing, replace the last segment
                      if (tags === '' || tags.endsWith(',') || tags.endsWith(', ')) {
                        setTags(existing.length > 0 ? existing.join(', ') + ', ' + e.target.value : e.target.value);
                      } else {
                        setTags([...existing.slice(0, -1), e.target.value].join(', '));
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        const val = (tags.split(',').pop()?.trim() ?? '');
                        if (val) setTags(tags.endsWith(',') ? tags + ' ' : tags + ', ');
                      }
                    }}
                    placeholder={tags ? 'Add more…' : 'Type or pick below…'}
                    className="min-w-[80px] flex-1 bg-transparent text-sm outline-none"
                  />
                </div>
                {/* Suggestions */}
                <div className="mt-2 flex flex-wrap gap-1">
                  {(allTags.data?.data ?? SUGGESTED_TAGS).filter((t) => {
                    const current = tags.split(',').map((s) => s.trim().toLowerCase());
                    return !current.includes(t.toLowerCase());
                  }).slice(0, 12).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        const list = tags.split(',').map((s) => s.trim()).filter(Boolean);
                        if (!list.map((s) => s.toLowerCase()).includes(t.toLowerCase())) {
                          setTags([...list, t].join(', '));
                        }
                      }}
                      className="rounded-full border border-dashed border-gray-300 px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-700"
                    >
                      + {t}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className="mt-8">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Paperclip className="mr-1 inline h-3 w-3" /> Attachments ({attachments.length})
                </h3>
                <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent">
                  <Upload className="h-3 w-3" />
                  {uploading ? 'Uploading…' : 'Upload'}
                  <input type="file" multiple className="hidden" onChange={handleAttachmentUpload} disabled={uploading} />
                </label>
              </div>
              {attachments.length === 0 ? (
                <p className="text-xs text-muted-foreground">No attachments yet.</p>
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
                        placeholder="Caption…"
                        className="mt-1 w-full rounded border px-2 py-1 text-xs"
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>
        )}
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
