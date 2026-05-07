'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Save, Send, Trash2, Paperclip, Upload, X, ImagePlus } from 'lucide-react';
import { TinyMCEEditor } from '@/components/knowledge/TinyMCEEditor';
import {
  usePublication,
  usePublishableCategories,
  useUpdatePublication,
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

const REVIEWER_ROLES = new Set(['SUPER_ADMIN', 'CONTINENTAL_ADMIN', 'KNOWLEDGE_MANAGER']);

export default function EditPublicationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const userLocale = (user?.locale ?? 'en').slice(0, 2) as Locale;
  const isReviewer = !!user?.roles?.some((r) => REVIEWER_ROLES.has(r));

  const { data: pubData, isLoading } = usePublication(id);

  const [initialized, setInitialized] = useState(false);
  const [activeLocale, setActiveLocale] = useState<Locale>(userLocale);
  const [title, setTitle] = useState<Record<Locale, string>>({ en: '', fr: '', pt: '', ar: '' });
  const [summary, setSummary] = useState<Record<Locale, string>>({ en: '', fr: '', pt: '', ar: '' });
  const [content, setContent] = useState<Record<Locale, string>>({ en: '', fr: '', pt: '', ar: '' });
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
  const updateMut = useUpdatePublication();
  const submitMut = useSubmitPublication();
  const allTags = useAllTags();

  // Pre-fill form with existing publication data
  useEffect(() => {
    if (!pubData?.data || initialized) return;
    const pub = pubData.data;

    const toLocales = (obj: any): Record<Locale, string> => ({
      en: obj?.en ?? '',
      fr: obj?.fr ?? '',
      pt: obj?.pt ?? '',
      ar: obj?.ar ?? '',
    });

    setTitle(toLocales(pub.title));
    setSummary(toLocales(pub.summary));
    setContent(toLocales(pub.contentHtml));
    setCategoryId(pub.categoryId ?? '');
    setType(pub.type);
    setVisibility(pub.visibility);
    setTags((pub.tags ?? []).join(', '));
    setAuthors((pub.authors ?? []).join(', '));
    setCoverImageId(pub.coverImageId ?? null);
    if (pub.coverImageId) {
      setCoverPreview(`/api/v1/drive/files/${pub.coverImageId}/download`);
    }
    if (pub.attachments && pub.attachments.length > 0) {
      setAttachments(
        pub.attachments.map((a) => ({
          id: a.fileId,
          filename: a.caption || a.fileId,
          mimeType: '',
          size: 0,
          caption: a.caption ?? '',
          kind: a.kind as any,
        })),
      );
    }
    setInitialized(true);
  }, [pubData, initialized]);

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
      setCoverPreview(URL.createObjectURL(file));
      const uploaded = await uploadFile(file, { classification: 'PUBLIC' });
      setCoverImageId(uploaded.id);
    } catch (err) {
      setCoverPreview(null);
      setError(err instanceof Error ? err.message : 'Cover upload failed');
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
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const buildPayload = () => ({
    id,
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

  const handleSave = async () => {
    setError(null);
    if (!categoryId) return setError('Please pick a category');
    if (!title[userLocale]) return setError('Title is required');
    if (!content[userLocale]) return setError('Content is required');
    try {
      await updateMut.mutateAsync(buildPayload());
      router.push(`/knowledge/admin/publications/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  const handleSaveAndSubmit = async () => {
    setError(null);
    if (!categoryId) return setError('Please pick a category');
    if (!title[userLocale]) return setError('Title is required');
    if (!content[userLocale]) return setError('Content is required');
    try {
      await updateMut.mutateAsync(buildPayload());
      await submitMut.mutateAsync(id);
      router.push('/knowledge/admin/mine');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit');
    }
  };

  if (isLoading) return <p className="p-6 text-sm text-muted-foreground">Loading...</p>;
  if (!pubData?.data) return <p className="p-6 text-sm text-muted-foreground">Not found</p>;

  const pub = pubData.data;
  const isOwner = pub.createdBy === user?.id;
  const canEdit =
    (pub.status === 'DRAFT' || pub.status === 'REJECTED') && (isOwner || isReviewer);

  if (!canEdit) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 p-6">
        <p className="text-sm text-muted-foreground">
          This publication cannot be edited in its current status ({pub.status}).
        </p>
        <Link
          href={`/knowledge/admin/publications/${id}`}
          className="text-sm text-primary hover:underline"
        >
          Back to publication
        </Link>
      </div>
    );
  }

  const currentTags = tags.split(',').map((s) => s.trim()).filter(Boolean);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href={`/knowledge/admin/publications/${id}`}
            className="mb-2 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to publication
          </Link>
          <h1 className="text-2xl font-bold">Edit publication</h1>
          <p className="text-sm text-muted-foreground">
            Editing &ldquo;{title[userLocale] || title.en || 'Untitled'}&rdquo;
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

      {pub.rejectionReason && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <strong>Reviewer feedback:</strong> {pub.rejectionReason}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Main content */}
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

        {/* Sidebar settings */}
        <div className="space-y-4">
          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={updateMut.isPending}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
            >
              <Save className="h-4 w-4" /> Save
            </button>
            {(pub.status === 'DRAFT' || pub.status === 'REJECTED') && (
              <button
                onClick={handleSaveAndSubmit}
                disabled={updateMut.isPending || submitMut.isPending}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Send className="h-4 w-4" /> Save & Submit
              </button>
            )}
          </div>

          {/* Featured image */}
          <div className="rounded-lg border bg-card p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <ImagePlus className="mr-1 inline h-3.5 w-3.5" /> Featured image
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
                    <Upload className="h-3 w-3" /> Replace
                    <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} disabled={coverUploading} />
                  </label>
                  <button
                    onClick={() => { setCoverImageId(null); setCoverPreview(null); }}
                    className="inline-flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-3 w-3" /> Remove
                  </button>
                </div>
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50/50 py-8 transition-colors hover:border-emerald-400 hover:bg-emerald-50/50 dark:border-gray-600 dark:bg-gray-800/50 dark:hover:border-emerald-600 dark:hover:bg-emerald-900/20">
                {coverUploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
                    <span className="text-xs text-muted-foreground">Uploading...</span>
                  </div>
                ) : (
                  <>
                    <ImagePlus className="mb-2 h-10 w-10 text-gray-400" strokeWidth={1.2} />
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Click to upload</span>
                    <span className="mt-1 text-xs text-muted-foreground">JPG, PNG or WebP (recommended 1200x630)</span>
                  </>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} disabled={coverUploading} />
              </label>
            )}
          </div>

          {/* Settings card */}
          <div className="rounded-lg border bg-card p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Settings</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium">Category</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="">-- pick a category --</option>
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
            </div>
          </div>

          {/* Tags card */}
          <div className="rounded-lg border bg-card p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Tags</h2>
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
                placeholder={currentTags.length ? 'Add more...' : 'Type or pick below...'}
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
                <Paperclip className="mr-1 inline h-3 w-3" /> Attachments ({attachments.length})
              </h2>
              <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent">
                <Upload className="h-3 w-3" />
                {uploading ? 'Uploading...' : 'Upload'}
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
