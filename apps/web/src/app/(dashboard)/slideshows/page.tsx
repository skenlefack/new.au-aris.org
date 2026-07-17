'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Play, Edit, Trash2, Copy, Presentation } from 'lucide-react';
import { useLocaleStore } from '@/lib/stores/locale-store';
import {
  useSlideshows,
  useDeleteSlideshow,
  type Slideshow,
} from '@/lib/api/slideshow-hooks';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

export default function SlideshowsPage() {
  const router = useRouter();
  const { locale } = useLocaleStore();
  const isFr = locale === 'fr';

  const { data, isLoading } = useSlideshows();
  const deleteMutation = useDeleteSlideshow();
  const slideshows: Slideshow[] = (data as any)?.data ?? [];

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDelete = async () => {
    if (deleteId) {
      await deleteMutation.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/slideshow/${token}`;
    navigator.clipboard.writeText(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Presentation className="h-6 w-6" />
            {isFr ? 'Diaporamas' : 'Slideshows'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isFr
              ? 'Configurez et partagez des presentations de tableaux de bord.'
              : 'Configure and share dashboard presentations.'}
          </p>
        </div>
        <button
          onClick={() => router.push('/slideshows/new')}
          className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          {isFr ? 'Nouveau diaporama' : 'New Slideshow'}
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="text-muted-foreground py-12 text-center">
          {isFr ? 'Chargement...' : 'Loading...'}
        </div>
      ) : slideshows.length === 0 ? (
        <div className="rounded-lg border bg-white shadow-sm dark:bg-gray-900 dark:border-gray-700">
          <div className="py-12 text-center p-4">
            <Presentation className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-lg text-muted-foreground">
              {isFr ? 'Aucun diaporama cree' : 'No slideshows created'}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {isFr
                ? 'Creez un diaporama pour afficher vos tableaux de bord en mode presentation.'
                : 'Create a slideshow to display your dashboards in presentation mode.'}
            </p>
            <button
              className="mt-4 inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700"
              onClick={() => router.push('/slideshows/new')}
            >
              <Plus className="h-4 w-4 mr-2" />
              {isFr ? 'Creer un diaporama' : 'Create a slideshow'}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {slideshows.map((s) => (
            <div
              key={s.id}
              className="rounded-lg border bg-white shadow-sm hover:shadow-md transition-shadow dark:bg-gray-900 dark:border-gray-700"
            >
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">
                      {isFr ? s.titleFr : s.titleEn}
                    </h3>
                    {s.description && (
                      <p className="text-sm text-muted-foreground truncate mt-1">
                        {s.description}
                      </p>
                    )}
                  </div>
                  <span
                    className={
                      s.isActive
                        ? 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                        : 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                    }
                  >
                    {s.isActive
                      ? isFr
                        ? 'Actif'
                        : 'Active'
                      : isFr
                        ? 'Inactif'
                        : 'Inactive'}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                  <span>
                    {s.slides?.length ?? 0} slide{(s.slides?.length ?? 0) !== 1 ? 's' : ''}
                  </span>
                  <span>&middot;</span>
                  <span>{Math.round((s.intervalMs ?? 15000) / 1000)}s</span>
                  <span>&middot;</span>
                  <span>{s.transition ?? 'FADE'}</span>
                </div>

                <div className="flex gap-1">
                  <button
                    className="inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium border border-gray-300 bg-white hover:bg-gray-50 dark:bg-gray-900 dark:border-gray-700 dark:hover:bg-gray-800 flex-1"
                    onClick={() => router.push(`/slideshows/${s.id}/edit`)}
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    {isFr ? 'Modifier' : 'Edit'}
                  </button>
                  <button
                    className="inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium border border-gray-300 bg-white hover:bg-gray-50 dark:bg-gray-900 dark:border-gray-700 dark:hover:bg-gray-800"
                    onClick={() =>
                      window.open(`/slideshow/${s.publicToken}`, '_blank')
                    }
                  >
                    <Play className="h-3 w-3" />
                  </button>
                  <button
                    className="inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium border border-gray-300 bg-white hover:bg-gray-50 dark:bg-gray-900 dark:border-gray-700 dark:hover:bg-gray-800"
                    onClick={() => copyLink(s.publicToken)}
                    title={isFr ? 'Copier le lien' : 'Copy link'}
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                  <button
                    className="inline-flex items-center justify-center rounded-md px-2 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 text-red-600"
                    onClick={() => setDeleteId(s.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteId}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        title={isFr ? 'Supprimer le diaporama ?' : 'Delete slideshow?'}
        message={
          isFr
            ? 'Cette action est irreversible. Le lien public sera invalide.'
            : 'This action is irreversible. The public link will be invalidated.'
        }
        confirmLabel={isFr ? 'Supprimer' : 'Delete'}
        cancelLabel={isFr ? 'Annuler' : 'Cancel'}
        variant="danger"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
