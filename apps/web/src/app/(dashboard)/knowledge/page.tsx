'use client';

import React from 'react';
import Link from 'next/link';
import {
  BookOpen,
  GraduationCap,
  Users,
  Download,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  HelpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useKnowledgeKpis,
  usePublications,
  useElearningCourses,
  type Publication,
  type ElearningCourse,
  type KnowledgeKpis,
} from '@/lib/api/hooks';
import { Skeleton } from '@/components/ui/Skeleton';
import { QueryError } from '@/components/ui/QueryError';
import { DomainCampaignsSection } from '@/components/domain/DomainCampaignsSection';
import { QuickAlertCard, type AlertField } from '@/components/domain/QuickAlertCard';
import { useDomainConfig } from '@/lib/hooks/use-domain-config';

const KNOWLEDGE_ALERT_FIELDS: AlertField[] = [
  { name: 'topic', label: 'Topic', type: 'text', placeholder: 'e.g. Outbreak Response Guidelines', required: true },
  { name: 'type', label: 'Resource Type', type: 'select', required: true, options: ['Publication', 'Course', 'Dataset', 'FAQ', 'Guideline'] },
  { name: 'description', label: 'Description', type: 'textarea', placeholder: 'Describe the content request or issue...' },
];

const TYPE_BADGE: Record<string, string> = {
  brief: 'bg-blue-100 text-blue-700',
  report: 'bg-green-100 text-green-700',
  guideline: 'bg-amber-100 text-amber-700',
  dataset: 'bg-purple-100 text-purple-700',
  infographic: 'bg-pink-100 text-pink-700',
};

const LEVEL_BADGE: Record<string, string> = {
  beginner: 'bg-green-100 text-green-700',
  intermediate: 'bg-blue-100 text-blue-700',
  advanced: 'bg-purple-100 text-purple-700',
};

const PLACEHOLDER_KPIS: KnowledgeKpis['data'] = {
  totalPublications: 284,
  publicationsTrend: 12,
  activeCourses: 18,
  totalEnrolled: 3420,
  avgCompletionRate: 72.5,
  completionTrend: 4.3,
  totalDownloads: 15820,
  downloadsTrend: 8.7,
};

const PLACEHOLDER_PUBLICATIONS: Publication[] = [
  {
    id: 'pub-1',
    title: 'Continental Strategy for the Control of FMD in Africa 2026',
    description: 'Comprehensive strategy document outlining coordinated approaches to FMD control across AU Member States.',
    domain: 'Animal Health',
    type: 'report',
    authors: ['AU-IBAR', 'FAO', 'WOAH'],
    publishedAt: '2026-02-10T00:00:00Z',
    language: 'English',
    downloadUrl: '/downloads/fmd-strategy-2026.pdf',
    tags: ['FMD', 'strategy', 'continental'],
    downloads: 1245,
    createdAt: '2026-02-10T00:00:00Z',
  },
  {
    id: 'pub-2',
    title: 'Policy Brief: Transhumance Corridors and Trade Facilitation',
    description: 'Analysis of cross-border livestock movement patterns and their implications for trade policy under AfCFTA.',
    domain: 'Trade & Markets',
    type: 'brief',
    authors: ['Dr. Akinwumi Ade', 'Prof. Fatima Ndiaye'],
    publishedAt: '2026-01-25T00:00:00Z',
    language: 'English',
    downloadUrl: '/downloads/transhumance-brief.pdf',
    tags: ['transhumance', 'trade', 'AfCFTA'],
    downloads: 892,
    createdAt: '2026-01-25T00:00:00Z',
  },
  {
    id: 'pub-3',
    title: 'Guidelines for Aquatic Animal Health Surveillance in Africa',
    description: 'Technical guidelines for establishing and maintaining aquatic health surveillance systems at national level.',
    domain: 'Fisheries',
    type: 'guideline',
    authors: ['AU-IBAR Fisheries Unit'],
    publishedAt: '2026-01-15T00:00:00Z',
    language: 'English',
    downloadUrl: '/downloads/aquatic-surveillance-guidelines.pdf',
    tags: ['fisheries', 'surveillance', 'aquatic health'],
    downloads: 567,
    createdAt: '2026-01-15T00:00:00Z',
  },
];

const PLACEHOLDER_COURSES: ElearningCourse[] = [
  {
    id: 'course-1',
    title: 'Introduction to ARIS Platform',
    description: 'Learn the fundamentals of the ARIS platform, from data entry to report generation.',
    domain: 'Platform',
    level: 'beginner',
    durationMinutes: 120,
    lessonsCount: 8,
    enrolledCount: 845,
    completionRate: 82,
    instructor: 'Dr. Sarah Okonkwo',
    status: 'published',
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'course-2',
    title: 'Disease Outbreak Investigation and Reporting',
    description: 'Advanced techniques for investigating and reporting disease outbreaks through WAHIS-aligned workflows.',
    domain: 'Animal Health',
    level: 'intermediate',
    durationMinutes: 240,
    lessonsCount: 12,
    enrolledCount: 432,
    completionRate: 65,
    instructor: 'Prof. Jean-Baptiste Mugenzi',
    status: 'published',
    createdAt: '2026-01-10T00:00:00Z',
  },
  {
    id: 'course-3',
    title: 'Data Quality Management for National Focal Points',
    description: 'Master the 8 quality gates used in ARIS for ensuring data integrity and completeness.',
    domain: 'Data Quality',
    level: 'advanced',
    durationMinutes: 180,
    lessonsCount: 10,
    enrolledCount: 278,
    completionRate: 58,
    instructor: 'Dr. Amina Bello',
    status: 'published',
    createdAt: '2026-01-20T00:00:00Z',
  },
];

export default function KnowledgePortalPage() {
  const { data: kpiData, isLoading: kpiLoading, isError: kpiError, error: kpiErr, refetch: refetchKpis } = useKnowledgeKpis();
  const { data: pubData, isLoading: pubLoading } = usePublications({ limit: 3 });
  const { data: courseData, isLoading: courseLoading } = useElearningCourses({ limit: 3 });
  const { sections } = useDomainConfig('knowledge');

  const kpis = { ...PLACEHOLDER_KPIS, ...kpiData?.data };
  const publications = pubData?.data ?? PLACEHOLDER_PUBLICATIONS;
  const courses = courseData?.data ?? PLACEHOLDER_COURSES;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Knowledge Hub</h1>
          <p className="mt-1 text-sm text-gray-500">
            Publications, e-learning, and resources for animal resources management
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/knowledge/publications"
            className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <BookOpen className="h-4 w-4" />
            Publications
          </Link>
          <Link
            href="/knowledge/elearning"
            className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <GraduationCap className="h-4 w-4" />
            E-Learning
          </Link>
          <Link
            href="/knowledge/faq"
            className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <HelpCircle className="h-4 w-4" />
            FAQ
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      {sections.kpis && (kpiError ? (
        <QueryError
          message={kpiErr instanceof Error ? kpiErr.message : 'Failed to load KPIs'}
          onRetry={() => refetchKpis()}
        />
      ) : kpiLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-card border border-gray-200 bg-white p-4">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-3 h-8 w-16" />
              <Skeleton className="mt-2 h-4 w-20" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-card border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                Total Publications
              </p>
              <BookOpen className="h-4 w-4 text-gray-300" />
            </div>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {kpis.totalPublications.toLocaleString()}
            </p>
            <div className="mt-1 flex items-center gap-1 text-xs">
              {kpis.publicationsTrend >= 0 ? (
                <TrendingUp className="h-3 w-3 text-green-500" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-500" />
              )}
              <span className={kpis.publicationsTrend >= 0 ? 'text-green-600' : 'text-red-600'}>
                {kpis.publicationsTrend > 0 ? '+' : ''}{kpis.publicationsTrend}%
              </span>
              <span className="text-gray-400">vs last quarter</span>
            </div>
          </div>
          <div className="rounded-card border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                Active Courses
              </p>
              <GraduationCap className="h-4 w-4 text-gray-300" />
            </div>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {kpis.activeCourses}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              {kpis.totalEnrolled.toLocaleString()} enrolled
            </p>
          </div>
          <div className="rounded-card border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                Total Enrolled
              </p>
              <Users className="h-4 w-4 text-gray-300" />
            </div>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {kpis.totalEnrolled.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              across all courses
            </p>
          </div>
          <div className="rounded-card border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                Avg Completion Rate
              </p>
              <Download className="h-4 w-4 text-gray-300" />
            </div>
            <p className="mt-2 text-2xl font-bold text-aris-primary-700">
              {kpis.avgCompletionRate}%
            </p>
            <div className="mt-1 flex items-center gap-1 text-xs">
              {kpis.completionTrend >= 0 ? (
                <TrendingUp className="h-3 w-3 text-green-500" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-500" />
              )}
              <span className={kpis.completionTrend >= 0 ? 'text-green-600' : 'text-red-600'}>
                {kpis.completionTrend > 0 ? '+' : ''}{kpis.completionTrend}%
              </span>
              <span className="text-gray-400">vs last quarter</span>
            </div>
          </div>
        </div>
      ))}

      {/* Two-column layout: Recent Publications + Featured Courses */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Publications */}
        <div className="rounded-card border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">
              Recent Publications
            </h2>
            <Link
              href="/knowledge/publications"
              className="flex items-center gap-1 text-xs font-medium text-aris-primary-600 hover:text-aris-primary-700"
            >
              View all
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {pubLoading ? (
            <div className="mt-4 space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {publications.map((pub) => (
                <div
                  key={pub.id}
                  className="rounded-lg border border-gray-100 p-3 hover:bg-gray-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                            TYPE_BADGE[pub.type],
                          )}
                        >
                          {pub.type}
                        </span>
                        <span className="text-xs text-gray-400">{pub.domain}</span>
                      </div>
                      <p className="mt-1 text-sm font-medium text-gray-900 line-clamp-1">
                        {pub.title}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Download className="h-3 w-3" />
                      {pub.downloads.toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Featured Courses */}
        <div className="rounded-card border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">
              Featured Courses
            </h2>
            <Link
              href="/knowledge/elearning"
              className="flex items-center gap-1 text-xs font-medium text-aris-primary-600 hover:text-aris-primary-700"
            >
              View all
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {courseLoading ? (
            <div className="mt-4 space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-2 w-full" />
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {courses.map((course) => (
                <Link
                  key={course.id}
                  href={`/knowledge/elearning/${course.id}`}
                  className="block rounded-lg border border-gray-100 p-3 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                        LEVEL_BADGE[course.level],
                      )}
                    >
                      {course.level}
                    </span>
                    <span className="text-xs text-gray-400">
                      {course.enrolledCount.toLocaleString()} enrolled
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-gray-900 line-clamp-1">
                    {course.title}
                  </p>
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>Completion rate</span>
                      <span className="font-medium text-gray-600">{course.completionRate}%</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                      <div
                        className={cn(
                          'h-full rounded-full',
                          course.completionRate >= 75
                            ? 'bg-green-500'
                            : course.completionRate >= 50
                              ? 'bg-amber-500'
                              : 'bg-red-500',
                        )}
                        style={{ width: `${Math.min(100, course.completionRate)}%` }}
                      />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Campaigns & Alert */}
      {(sections.campaigns || sections.alertForm) && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {sections.campaigns && <DomainCampaignsSection domain="knowledge" />}
          {sections.alertForm && <QuickAlertCard domain="knowledge" alertFields={KNOWLEDGE_ALERT_FIELDS} title="Request Content" />}
        </div>
      )}
    </div>
  );
}
