'use client';

// Create / edit a publication.
// Multilingual editor (TinyMCE) with tabs per locale, multi-attachment upload
// via the drive-service, and category picker restricted to the user's scope.

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Send, Trash2, Paperclip, Upload } from 'lucide-react';
import { TinyMCEEditor } from '@/components/knowledge/TinyMCEEditor';
import {
  usePublishableCategories,
  useCreatePublication,
  useSubmitPublication,
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

interface PendingAttachment extends UploadedFile {
  caption: string;
  kind: ReturnType<typeof detectAttachmentKind>;
}

export default function NewPublicationPage() {
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

  const cats = usePublishableCategories();
  const createMut = useCreatePublication();
  const submitMut = useSubmitPublication();

  // Group categories by scope for the picker
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
    // TinyMCE wants a public URL — point at the drive download endpoint
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
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">New publication</h1>
        <div className="flex gap-2">
          <button
            onClick={handleSaveDraft}
            disabled={createMut.isPending}
            className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm hover:bg-accent disabled:opacity-50"
          >
            <Save className="h-4 w-4" /> Save draft
          </button>
          <button
            onClick={handleSubmitForReview}
            disabled={createMut.isPending || submitMut.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Send className="h-4 w-4" /> Submit for review
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {/* Category + type + visibility */}
      <div className="grid gap-4 rounded-lg border bg-card p-6 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Category</label>
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
            <p className="mt-1 text-xs text-amber-600">No publishable categories available for your role.</p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as PublicationType)}
            className="w-full rounded-md border px-3 py-2 text-sm"
          >
            {PUBLICATION_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Visibility</label>
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as Visibility)}
            className="w-full rounded-md border px-3 py-2 text-sm"
          >
            <option value="PUBLIC">Public (no login required)</option>
            <option value="PRIVATE">Private (authenticated users only)</option>
          </select>
        </div>
      </div>

      {/* Locale tabs */}
      <div className="rounded-lg border bg-card">
        <div className="flex border-b">
          {LOCALES.map((loc) => (
            <button
              key={loc}
              onClick={() => setActiveLocale(loc)}
              className={`px-4 py-3 text-sm font-medium ${
                activeLocale === loc ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'
              }`}
            >
              {loc.toUpperCase()}
              {title[loc] ? ' ✓' : ''}
            </button>
          ))}
        </div>

        <div className="space-y-4 p-6">
          <div>
            <label className="mb-1 block text-sm font-medium">Title ({activeLocale.toUpperCase()})</label>
            <input
              value={title[activeLocale]}
              onChange={(e) => setTitle({ ...title, [activeLocale]: e.target.value })}
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Publication title…"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Summary ({activeLocale.toUpperCase()})</label>
            <textarea
              value={summary[activeLocale]}
              onChange={(e) => setSummary({ ...summary, [activeLocale]: e.target.value })}
              rows={3}
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder="Short summary shown in listings…"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Content ({activeLocale.toUpperCase()})</label>
            <TinyMCEEditor
              value={content[activeLocale]}
              onChange={(html) => setContent({ ...content, [activeLocale]: html })}
              language={activeLocale}
              onImageUpload={handleImageUpload}
            />
          </div>
        </div>
      </div>

      {/* Metadata */}
      <div className="grid gap-4 rounded-lg border bg-card p-6 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Authors (comma-separated)</label>
          <input
            value={authors}
            onChange={(e) => setAuthors(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
            placeholder="Jane Doe, John Smith"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Tags (comma-separated)</label>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
            placeholder="surveillance, kenya, foot-and-mouth"
          />
        </div>
      </div>

      {/* Attachments */}
      <div className="rounded-lg border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            <Paperclip className="mr-2 inline h-4 w-4" />
            Attachments ({attachments.length})
          </h2>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-accent">
            <Upload className="h-4 w-4" />
            {uploading ? 'Uploading…' : 'Upload files'}
            <input type="file" multiple className="hidden" onChange={handleAttachmentUpload} disabled={uploading} />
          </label>
        </div>
        {attachments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No attachments yet.</p>
        ) : (
          <ul className="space-y-2">
            {attachments.map((a, i) => (
              <li key={a.id} className="flex items-center gap-3 rounded-md border p-3">
                <span className="rounded bg-muted px-2 py-1 text-xs font-medium">{a.kind}</span>
                <span className="flex-1 truncate text-sm">{a.filename}</span>
                <input
                  value={a.caption}
                  onChange={(e) => {
                    const copy = [...attachments];
                    copy[i] = { ...a, caption: e.target.value };
                    setAttachments(copy);
                  }}
                  placeholder="Caption…"
                  className="w-48 rounded border px-2 py-1 text-xs"
                />
                <button
                  onClick={() => setAttachments(attachments.filter((_, j) => j !== i))}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
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
