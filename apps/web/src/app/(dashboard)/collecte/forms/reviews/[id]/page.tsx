'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft, MessageSquare, Send, FileText, Clock, CheckCircle2,
  User, Reply, Loader2, Eye, FileCheck, ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from '@/lib/i18n/translations';
import { useAuthStore } from '@/lib/stores/auth-store';
import {
  useReview,
  useAddReviewComment,
  useUpdateReviewSynthesis,
  useCloseReview,
  type ReviewCommentEntity,
} from '@/lib/api/form-builder-hooks';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { toast } from 'sonner';

const STATUS_STYLES: Record<string, { bg: string; icon: React.ReactNode }> = {
  PENDING: { bg: 'bg-amber-100 text-amber-700', icon: <Clock className="h-3 w-3" /> },
  IN_REVIEW: { bg: 'bg-blue-100 text-blue-700', icon: <MessageSquare className="h-3 w-3" /> },
  COMPLETED: { bg: 'bg-green-100 text-green-700', icon: <CheckCircle2 className="h-3 w-3" /> },
  CANCELLED: { bg: 'bg-gray-100 text-gray-500', icon: <Clock className="h-3 w-3" /> },
};

export default function ReviewDetailPage() {
  const params = useParams();
  const reviewId = params.id as string;
  const t = useTranslations('collecte');
  const user = useAuthStore((s) => s.user);

  const { data: reviewRes, isLoading } = useReview(reviewId);
  const addComment = useAddReviewComment();
  const updateSynthesis = useUpdateReviewSynthesis();
  const closeReview = useCloseReview();

  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [showSynthesis, setShowSynthesis] = useState(false);
  const [synthesisText, setSynthesisText] = useState('');

  const review = (reviewRes as any)?.data;
  const comments: ReviewCommentEntity[] = review?.comments ?? [];
  const isSender = user?.id === review?.senderId;

  // Build threaded comments
  const { topLevel, repliesMap } = useMemo(() => {
    const top: ReviewCommentEntity[] = [];
    const replies = new Map<string, ReviewCommentEntity[]>();
    for (const c of comments) {
      if (c.parentId) {
        const arr = replies.get(c.parentId) || [];
        arr.push(c);
        replies.set(c.parentId, arr);
      } else {
        top.push(c);
      }
    }
    return { topLevel: top, repliesMap: replies };
  }, [comments]);

  const handleSendComment = async (parentId?: string) => {
    const content = parentId ? replyContent : newComment;
    if (!content.trim()) return;
    try {
      await addComment.mutateAsync({ reviewId, content: content.trim(), parentId });
      if (parentId) { setReplyTo(null); setReplyContent(''); }
      else setNewComment('');
    } catch (err) {
      toast.error('Failed to add comment');
    }
  };

  const handleSaveSynthesis = async () => {
    if (!synthesisText.trim()) return;
    try {
      await updateSynthesis.mutateAsync({ reviewId, synthesis: synthesisText.trim() });
      toast.success(t('synthesisSaved') || 'Synthesis saved and review completed');
      setShowSynthesis(false);
    } catch (err) {
      toast.error('Failed to save synthesis');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Link href="/collecte/forms" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" /> {t('backToForms')}
        </Link>
        <TableSkeleton rows={5} cols={2} />
      </div>
    );
  }

  if (!review) {
    return (
      <div className="space-y-4">
        <Link href="/collecte/forms" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" /> {t('backToForms')}
        </Link>
        <p className="text-gray-500">Review not found.</p>
      </div>
    );
  }

  const statusCfg = STATUS_STYLES[review.status] || STATUS_STYLES.PENDING;

  return (
    <div className="space-y-6 pb-12 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <Link href="/collecte/forms" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          <ArrowLeft className="h-4 w-4" /> {t('backToForms')}
        </Link>
        <div className="mt-3 flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-blue-500" />
              {t('formReview') || 'Form Review'}
            </h1>
            {review.template && (
              <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
                <FileText className="h-4 w-4" />
                <Link href={`/collecte/forms/${review.templateId}/preview`} className="hover:text-blue-600 underline">
                  {review.template.name}
                </Link>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium', statusCfg.bg)}>
              {statusCfg.icon} {review.status}
            </span>
            {review.template && (
              <Link
                href={`/collecte/forms/${review.templateId}/preview`}
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <Eye className="h-3.5 w-3.5" /> {t('preview')}
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Sender info */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <p className="text-xs font-medium text-gray-500 mb-2">{t('sentBy') || 'Sent by'}</p>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-sm font-semibold">
              {review.senderName?.[0]?.toUpperCase() || 'U'}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{review.senderName}</p>
              <p className="text-xs text-gray-500">{new Date(review.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
          {review.message && (
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg p-3 italic">
              "{review.message}"
            </p>
          )}
        </div>

        {/* Reviewers */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <p className="text-xs font-medium text-gray-500 mb-2">{t('reviewers') || 'Reviewers'} ({review.reviewers?.length || 0})</p>
          <div className="space-y-2">
            {(review.reviewers || []).map((r: any) => (
              <div key={r.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-gray-600 text-xs font-semibold dark:bg-gray-800 dark:text-gray-400">
                    {r.userName?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-900 dark:text-white">{r.userName}</p>
                    <p className="text-[10px] text-gray-500">{r.userEmail}</p>
                  </div>
                </div>
                {r.hasRead ? (
                  <span className="text-[10px] text-green-600 flex items-center gap-0.5">
                    <CheckCircle2 className="h-3 w-3" /> {t('read') || 'Read'}
                  </span>
                ) : (
                  <span className="text-[10px] text-gray-400">{t('unread') || 'Unread'}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Synthesis (if exists) */}
      {review.synthesis && (
        <div className="rounded-xl border-2 border-green-200 bg-green-50 p-5 dark:border-green-800 dark:bg-green-900/10">
          <div className="flex items-center gap-2 mb-2">
            <FileCheck className="h-5 w-5 text-green-600" />
            <h3 className="text-sm font-semibold text-green-800 dark:text-green-400">{t('synthesis') || 'Synthesis'}</h3>
          </div>
          <p className="text-sm text-green-800 dark:text-green-300 whitespace-pre-wrap">{review.synthesis}</p>
        </div>
      )}

      {/* Comments section */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-gray-400" />
            {t('comments') || 'Comments'} ({comments.length})
          </h3>
          {isSender && review.status !== 'COMPLETED' && (
            <button
              onClick={() => { setShowSynthesis(!showSynthesis); setSynthesisText(review.synthesis || ''); }}
              className="inline-flex items-center gap-1 rounded-lg bg-green-50 border border-green-200 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors dark:bg-green-900/20 dark:border-green-800 dark:text-green-400"
            >
              <FileCheck className="h-3.5 w-3.5" />
              {t('compileSynthesis') || 'Compile Synthesis'}
            </button>
          )}
        </div>

        {/* Synthesis editor */}
        {showSynthesis && (
          <div className="border-b border-gray-200 p-5 bg-green-50/50 dark:border-gray-700 dark:bg-green-900/5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('synthesisDesc') || 'Compile a synthesis from all comments. This will close the review.'}
            </label>
            <textarea
              value={synthesisText}
              onChange={(e) => setSynthesisText(e.target.value)}
              rows={5}
              placeholder={t('synthesisPlaceholder') || 'Write your synthesis here...'}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-green-400 focus:outline-none focus:ring-1 focus:ring-green-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white resize-y"
            />
            <div className="mt-2 flex justify-end gap-2">
              <button onClick={() => setShowSynthesis(false)} className="rounded-lg px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800">
                {t('cancel')}
              </button>
              <button
                onClick={handleSaveSynthesis}
                disabled={!synthesisText.trim() || updateSynthesis.isPending}
                className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {updateSynthesis.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileCheck className="h-3 w-3" />}
                {t('saveSynthesis') || 'Save & Complete'}
              </button>
            </div>
          </div>
        )}

        {/* Comment list */}
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {topLevel.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">
              <MessageSquare className="mx-auto h-8 w-8 text-gray-300 mb-2" />
              {t('noCommentsYet') || 'No comments yet. Be the first to share your feedback.'}
            </div>
          ) : (
            topLevel.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                replies={repliesMap.get(comment.id) || []}
                currentUserId={user?.id || ''}
                replyTo={replyTo}
                replyContent={replyContent}
                onSetReplyTo={setReplyTo}
                onSetReplyContent={setReplyContent}
                onSendReply={(parentId) => handleSendComment(parentId)}
                isPending={addComment.isPending}
                t={t}
              />
            ))
          )}
        </div>

        {/* New comment input */}
        {review.status !== 'COMPLETED' && review.status !== 'CANCELLED' && (
          <div className="border-t border-gray-200 p-4 dark:border-gray-700">
            <div className="flex gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-sm font-semibold flex-shrink-0 mt-1">
                {user?.firstName?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder={t('writeComment') || 'Write a comment...'}
                  rows={2}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white resize-none"
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSendComment(); }}
                />
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[10px] text-gray-400">Ctrl+Enter to send</span>
                  <button
                    onClick={() => handleSendComment()}
                    disabled={!newComment.trim() || addComment.isPending}
                    className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {addComment.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                    {t('sendComment') || 'Comment'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Comment Item ─────────────────────────────────────────────────────────── */

function CommentItem({
  comment,
  replies,
  currentUserId,
  replyTo,
  replyContent,
  onSetReplyTo,
  onSetReplyContent,
  onSendReply,
  isPending,
  t,
}: {
  comment: ReviewCommentEntity;
  replies: ReviewCommentEntity[];
  currentUserId: string;
  replyTo: string | null;
  replyContent: string;
  onSetReplyTo: (id: string | null) => void;
  onSetReplyContent: (content: string) => void;
  onSendReply: (parentId: string) => void;
  isPending: boolean;
  t: (key: string) => string;
}) {
  const isOwn = comment.userId === currentUserId;
  const timeAgo = formatTimeAgo(comment.createdAt);

  return (
    <div className="px-5 py-4">
      <div className="flex gap-3">
        <div className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold flex-shrink-0',
          isOwn ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
        )}>
          {comment.userName?.[0]?.toUpperCase() || 'U'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">{comment.userName}</span>
            {isOwn && <span className="rounded bg-blue-50 px-1 py-0.5 text-[9px] font-medium text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">you</span>}
            <span className="text-xs text-gray-400">{timeAgo}</span>
          </div>
          <p className="mt-1 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{comment.content}</p>
          <button
            onClick={() => onSetReplyTo(replyTo === comment.id ? null : comment.id)}
            className="mt-1.5 inline-flex items-center gap-1 text-xs text-gray-400 hover:text-blue-500 transition-colors"
          >
            <Reply className="h-3 w-3" /> {t('reply') || 'Reply'}
          </button>
        </div>
      </div>

      {/* Replies */}
      {replies.length > 0 && (
        <div className="ml-11 mt-3 space-y-3 border-l-2 border-gray-100 pl-4 dark:border-gray-800">
          {replies.map((r) => {
            const isOwnReply = r.userId === currentUserId;
            return (
              <div key={r.id} className="flex gap-2.5">
                <div className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold flex-shrink-0',
                  isOwnReply ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
                )}>
                  {r.userName?.[0]?.toUpperCase() || 'U'}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-gray-900 dark:text-white">{r.userName}</span>
                    <span className="text-[10px] text-gray-400">{formatTimeAgo(r.createdAt)}</span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{r.content}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reply input */}
      {replyTo === comment.id && (
        <div className="ml-11 mt-3 flex gap-2">
          <input
            type="text"
            value={replyContent}
            onChange={(e) => onSetReplyContent(e.target.value)}
            placeholder={t('writeReply') || 'Write a reply...'}
            className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            onKeyDown={(e) => { if (e.key === 'Enter') onSendReply(comment.id); }}
            autoFocus
          />
          <button
            onClick={() => onSendReply(comment.id)}
            disabled={!replyContent.trim() || isPending}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
          </button>
        </div>
      )}
    </div>
  );
}

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const d = new Date(dateStr).getTime();
  const diff = now - d;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}
