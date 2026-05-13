'use client';

import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Send, Search, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n/translations';
import { useCreateReview } from '@/lib/api/form-builder-hooks';
import { useSettingsUsers, type ManagedUser } from '@/lib/api/settings-hooks';
import { useAuthStore } from '@/lib/stores/auth-store';
import { toast } from 'sonner';

interface SendReviewModalProps {
  templateId: string;
  templateName: string;
  onClose: () => void;
}

export function SendReviewModal({ templateId, templateName, onClose }: SendReviewModalProps) {
  const t = useTranslations('collecte');
  const user = useAuthStore((s) => s.user);
  const [visible, setVisible] = useState(true);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<Map<string, { userId: string; userName: string; userEmail: string; tenantId: string }>>(new Map());

  const createReview = useCreateReview();
  const { data: usersData, isLoading: usersLoading } = useSettingsUsers({ limit: 200 });

  // Filter out current user and filter by search
  const availableUsers = useMemo(() => {
    const all = (usersData as any)?.data ?? [];
    return all.filter((u: ManagedUser) => {
      if (u.id === user?.id) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        u.firstName?.toLowerCase().includes(q) ||
        u.lastName?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q)
      );
    });
  }, [usersData, user, search]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 200);
  };

  const toggleUser = (u: ManagedUser) => {
    const next = new Map(selectedUsers);
    if (next.has(u.id)) {
      next.delete(u.id);
    } else {
      next.set(u.id, {
        userId: u.id,
        userName: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email,
        userEmail: u.email,
        tenantId: (u as any).tenantId || user?.tenantId || '',
      });
    }
    setSelectedUsers(next);
  };

  const handleSubmit = async () => {
    if (selectedUsers.size === 0) return;
    try {
      await createReview.mutateAsync({
        templateId,
        message: message.trim() || undefined,
        reviewers: Array.from(selectedUsers.values()),
      });
      toast.success(t('reviewSent') || 'Review request sent successfully');
      handleClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send review');
    }
  };

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 flex items-center justify-center transition-all duration-200',
        visible ? 'bg-black/50 backdrop-blur-[6px]' : 'bg-black/0 backdrop-blur-0',
      )}
      style={{ zIndex: 99999 }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        className={cn(
          'flex w-[95vw] max-w-2xl flex-col rounded-2xl bg-white shadow-2xl dark:bg-gray-900 transition-all duration-200 max-h-[85vh]',
          visible ? 'scale-100 opacity-100' : 'scale-95 opacity-0',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Send className="h-5 w-5 text-blue-500" />
              {t('sendForReview') || 'Send for Review'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">{templateName}</p>
          </div>
          <button onClick={handleClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t('reviewMessage') || 'Message to reviewers'}
              <span className="ml-1 text-xs font-normal text-gray-400">({t('optionalField')})</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t('reviewMessagePlaceholder') || 'Please review this form and provide your feedback...'}
              rows={3}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white resize-none"
            />
          </div>

          {/* Selected reviewers */}
          {selectedUsers.size > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {Array.from(selectedUsers.values()).map((u) => (
                <span
                  key={u.userId}
                  className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400"
                >
                  {u.userName}
                  <button onClick={() => { const next = new Map(selectedUsers); next.delete(u.userId); setSelectedUsers(next); }} className="text-blue-400 hover:text-red-500">&times;</button>
                </span>
              ))}
            </div>
          )}

          {/* Search users */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t('selectReviewers') || 'Select reviewers'} <span className="text-red-500">*</span>
            </label>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('searchUsers') || 'Search by name or email...'}
                className="w-full rounded-lg border border-gray-200 py-2 pl-10 pr-4 text-sm placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-50 dark:divide-gray-800">
              {usersLoading ? (
                <div className="flex items-center justify-center p-4 text-sm text-gray-400">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading users...
                </div>
              ) : availableUsers.length === 0 ? (
                <p className="p-4 text-sm text-gray-400 text-center">{t('noUsersFound') || 'No users found'}</p>
              ) : (
                availableUsers.map((u: ManagedUser) => {
                  const isSelected = selectedUsers.has(u.id);
                  const roleBadge = (u as any).roles?.[0]?.code || (u as any).role || '';
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => toggleUser(u)}
                      className={cn(
                        'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors',
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-900/10'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800',
                      )}
                    >
                      <div className={cn(
                        'flex h-5 w-5 items-center justify-center rounded border transition-colors flex-shrink-0',
                        isSelected
                          ? 'border-blue-500 bg-blue-500 text-white'
                          : 'border-gray-300 dark:border-gray-600',
                      )}>
                        {isSelected && <Check className="h-3 w-3" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {u.firstName} {u.lastName}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{u.email}</p>
                      </div>
                      {roleBadge && (
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[9px] font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400 flex-shrink-0">
                          {roleBadge}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4 dark:border-gray-700">
          <span className="text-xs text-gray-500">
            {selectedUsers.size} {t('reviewersSelected') || 'reviewer(s) selected'}
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={handleClose}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              {t('cancel')}
            </button>
            <button
              onClick={handleSubmit}
              disabled={selectedUsers.size === 0 || createReview.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {createReview.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {t('sendReview') || 'Send for Review'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
