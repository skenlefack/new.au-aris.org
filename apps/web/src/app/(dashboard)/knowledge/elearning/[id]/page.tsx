'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Clock,
  Users,
  BookOpen,
  GraduationCap,
  PlayCircle,
  FileText,
  HelpCircle,
  Code,
  CheckCircle2,
  Circle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useElearningCourse, type ElearningCourseDetail, type ElearningLesson } from '@/lib/api/hooks';
import { DetailSkeleton } from '@/components/ui/Skeleton';
import { QueryError } from '@/components/ui/QueryError';
import { useTranslations } from '@/lib/i18n/translations';

const LEVEL_BADGE: Record<string, string> = {
  beginner: 'bg-green-100 text-green-700',
  intermediate: 'bg-blue-100 text-blue-700',
  advanced: 'bg-purple-100 text-purple-700',
};

const LESSON_TYPE_ICON: Record<string, React.ReactNode> = {
  video: <PlayCircle className="h-4 w-4 text-blue-500" />,
  text: <FileText className="h-4 w-4 text-gray-500" />,
  quiz: <HelpCircle className="h-4 w-4 text-amber-500" />,
  exercise: <Code className="h-4 w-4 text-purple-500" />,
};

const LESSON_TYPE_BADGE: Record<string, string> = {
  video: 'bg-blue-100 text-blue-700',
  text: 'bg-gray-100 text-gray-700',
  quiz: 'bg-amber-100 text-amber-700',
  exercise: 'bg-purple-100 text-purple-700',
};

const PLACEHOLDER_DETAIL: ElearningCourseDetail = {
  id: 'course-2',
  title: 'Disease Outbreak Investigation and Reporting',
  description: 'Advanced techniques for investigating and reporting disease outbreaks through WAHIS-aligned workflows. This course covers the full lifecycle of disease event management, from initial field detection through laboratory confirmation to official notification via the WAHIS platform. Participants will gain hands-on experience with the ARIS outbreak reporting module, sample management workflows, and the 4-level validation process.',
  domain: 'Animal Health',
  level: 'intermediate',
  durationMinutes: 240,
  lessonsCount: 8,
  enrolledCount: 432,
  completionRate: 65,
  instructor: 'Prof. Jean-Baptiste Mugenzi',
  status: 'published',
  createdAt: '2026-01-10T00:00:00Z',
  lessons: [
    { id: 'les-1', title: 'Introduction to Disease Surveillance Concepts', order: 1, durationMinutes: 20, type: 'video', completed: true },
    { id: 'les-2', title: 'Understanding the ARIS Event Reporting Module', order: 2, durationMinutes: 30, type: 'video', completed: true },
    { id: 'les-3', title: 'Field Investigation Methodology', order: 3, durationMinutes: 35, type: 'text', completed: true },
    { id: 'les-4', title: 'Sample Collection and Chain of Custody', order: 4, durationMinutes: 25, type: 'video', completed: true },
    { id: 'les-5', title: 'Knowledge Check: Investigation Procedures', order: 5, durationMinutes: 15, type: 'quiz', completed: false },
    { id: 'les-6', title: 'Laboratory Result Interpretation', order: 6, durationMinutes: 30, type: 'text', completed: false },
    { id: 'les-7', title: 'Hands-on: Create an Outbreak Report in ARIS', order: 7, durationMinutes: 45, type: 'exercise', completed: false },
    { id: 'les-8', title: 'WAHIS Notification and 4-Level Validation Workflow', order: 8, durationMinutes: 40, type: 'video', completed: false },
  ],
  userProgress: {
    completedLessons: 4,
    lastAccessedAt: '2026-02-18T14:30:00Z',
    percentComplete: 50,
  },
};

export default function CourseDetailPage() {
  const t = useTranslations('knowledge');
  const params = useParams();
  const courseId = params.id as string;

  const { data, isLoading, isError, error, refetch } = useElearningCourse(courseId);
  const course = data?.data ?? PLACEHOLDER_DETAIL;

  if (isLoading) return <DetailSkeleton />;
  if (isError) {
    return (
      <QueryError
        message={error instanceof Error ? error.message : 'Failed to load course'}
        onRetry={() => refetch()}
      />
    );
  }

  const totalDuration = course.lessons.reduce((sum, l) => sum + l.durationMinutes, 0);
  const completedCount = course.lessons.filter((l) => l.completed).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link
          href="/knowledge/elearning"
          className="mt-1 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{course.title}</h1>
            <span
              className={cn(
                'rounded-full px-2.5 py-0.5 text-xs font-medium capitalize',
                LEVEL_BADGE[course.level],
              )}
            >
              {course.level}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {course.domain} — {t('instructor')}: {course.instructor}
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-card border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-400" />
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
              {t('duration')}
            </p>
          </div>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {totalDuration >= 60
              ? `${Math.floor(totalDuration / 60)}h ${totalDuration % 60 > 0 ? `${totalDuration % 60}m` : ''}`
              : `${totalDuration}m`}
          </p>
        </div>
        <div className="rounded-card border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-gray-400" />
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
              {t('lessons')}
            </p>
          </div>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {course.lessons.length}
          </p>
        </div>
        <div className="rounded-card border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-gray-400" />
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
              {t('enrolled')}
            </p>
          </div>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {course.enrolledCount.toLocaleString()}
          </p>
        </div>
        <div className="rounded-card border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-gray-400" />
            <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
              {t('completion')}
            </p>
          </div>
          <p className="mt-1 text-2xl font-bold text-aris-primary-700">
            {course.completionRate}%
          </p>
        </div>
      </div>

      {/* User Progress */}
      {course.userProgress && (
        <div className="rounded-card border border-aris-primary-200 bg-aris-primary-50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-aris-primary-700">Your Progress</p>
              <p className="mt-0.5 text-xs text-aris-primary-600">
                {completedCount} of {course.lessons.length} lessons completed
                {course.userProgress.lastAccessedAt && (
                  <> — Last accessed {new Date(course.userProgress.lastAccessedAt).toLocaleDateString()}</>
                )}
              </p>
            </div>
            <span className="text-lg font-bold text-aris-primary-700">
              {course.userProgress.percentComplete}%
            </span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-aris-primary-200">
            <div
              className="h-full rounded-full bg-aris-primary-500 transition-all"
              style={{ width: `${Math.min(100, course.userProgress.percentComplete)}%` }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Lesson List */}
        <div className="space-y-0 lg:col-span-2">
          <div className="rounded-card border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="text-sm font-semibold text-gray-900">Course Lessons</h2>
              <p className="mt-0.5 text-xs text-gray-400">
                Complete all lessons to earn your certificate
              </p>
            </div>
            <div className="divide-y divide-gray-50">
              {course.lessons.map((lesson: ElearningLesson) => (
                <div
                  key={lesson.id}
                  className={cn(
                    'flex items-center gap-4 px-6 py-3 hover:bg-gray-50',
                    lesson.completed && 'bg-green-50/30',
                  )}
                >
                  {/* Order number */}
                  <div
                    className={cn(
                      'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-medium',
                      lesson.completed
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500',
                    )}
                  >
                    {lesson.order}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <p className={cn(
                      'text-sm font-medium',
                      lesson.completed ? 'text-gray-600' : 'text-gray-900',
                    )}>
                      {lesson.title}
                    </p>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-400">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                          LESSON_TYPE_BADGE[lesson.type],
                        )}
                      >
                        {LESSON_TYPE_ICON[lesson.type]}
                        {lesson.type}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {lesson.durationMinutes}m
                      </span>
                    </div>
                  </div>

                  {/* Completed indicator */}
                  <div className="flex-shrink-0">
                    {lesson.completed ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <Circle className="h-5 w-5 text-gray-300" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Course Description */}
          <section className="rounded-card border border-gray-200 bg-white p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              About This Course
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              {course.description}
            </p>
          </section>

          {/* Course Info */}
          <section className="rounded-card border border-gray-200 bg-white p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Course Details
            </h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-gray-500">{t('instructor')}</dt>
                <dd className="font-medium text-gray-900">{course.instructor}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-gray-500">Domain</dt>
                <dd className="font-medium text-gray-900">{course.domain}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-gray-500">Level</dt>
                <dd>
                  <span className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                    LEVEL_BADGE[course.level],
                  )}>
                    {course.level}
                  </span>
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-gray-500">Status</dt>
                <dd className="font-medium capitalize text-gray-900">{course.status}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-gray-500">Created</dt>
                <dd className="font-medium text-gray-900">
                  {new Date(course.createdAt).toLocaleDateString()}
                </dd>
              </div>
            </dl>
          </section>

          {/* Lesson Type Legend */}
          <section className="rounded-card border border-gray-200 bg-white p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Lesson Types
            </h3>
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <PlayCircle className="h-4 w-4 text-blue-500" />
                <span>Video — Watch and learn</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <FileText className="h-4 w-4 text-gray-500" />
                <span>Text — Read and study</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <HelpCircle className="h-4 w-4 text-amber-500" />
                <span>Quiz — Test your knowledge</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <Code className="h-4 w-4 text-purple-500" />
                <span>Exercise — Hands-on practice</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
