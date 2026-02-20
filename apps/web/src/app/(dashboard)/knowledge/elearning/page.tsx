'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Search,
  Filter,
  Clock,
  Users,
  BookOpen,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useElearningCourses, type ElearningCourse } from '@/lib/api/hooks';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { QueryError } from '@/components/ui/QueryError';

const LEVEL_BADGE: Record<string, string> = {
  beginner: 'bg-green-100 text-green-700',
  intermediate: 'bg-blue-100 text-blue-700',
  advanced: 'bg-purple-100 text-purple-700',
};

const PLACEHOLDER_COURSES: ElearningCourse[] = [
  {
    id: 'course-1',
    title: 'Introduction to ARIS 3.0 Platform',
    description: 'Learn the fundamentals of the ARIS platform, from data entry to report generation. Covers the multi-tenant hierarchy, form submission workflows, and dashboard navigation.',
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
    description: 'Advanced techniques for investigating and reporting disease outbreaks through WAHIS-aligned workflows. Includes field investigation methodology, sample collection, and event reporting.',
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
    description: 'Master the 8 quality gates used in ARIS for ensuring data integrity and completeness. Covers completeness checks, temporal consistency, geographic validation, and deduplication.',
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
  {
    id: 'course-4',
    title: 'Fisheries Data Collection and Reporting',
    description: 'Practical course on capturing fisheries data including marine captures, inland fisheries, aquaculture production, and fleet registration aligned with FishStatJ standards.',
    domain: 'Fisheries',
    level: 'beginner',
    durationMinutes: 90,
    lessonsCount: 6,
    enrolledCount: 312,
    completionRate: 74,
    instructor: 'Dr. Kwame Asante',
    status: 'published',
    createdAt: '2026-01-15T00:00:00Z',
  },
  {
    id: 'course-5',
    title: 'SPS Certification and Trade Compliance',
    description: 'Understanding Sanitary and Phytosanitary measures for animal products trade within Africa. Covers certificate issuance, border inspection procedures, and AfCFTA requirements.',
    domain: 'Trade & SPS',
    level: 'intermediate',
    durationMinutes: 150,
    lessonsCount: 9,
    enrolledCount: 198,
    completionRate: 61,
    instructor: 'Dr. Fatou Diallo',
    status: 'published',
    createdAt: '2026-02-01T00:00:00Z',
  },
  {
    id: 'course-6',
    title: 'Wildlife Conservation Data Management',
    description: 'Advanced course on managing wildlife inventory data, CITES reporting, protected area monitoring, and human-wildlife conflict documentation in the ARIS system.',
    domain: 'Wildlife',
    level: 'advanced',
    durationMinutes: 200,
    lessonsCount: 11,
    enrolledCount: 156,
    completionRate: 45,
    instructor: 'Prof. Tunde Adeyemi',
    status: 'published',
    createdAt: '2026-02-05T00:00:00Z',
  },
];

export default function ElearningCatalogPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [domainFilter, setDomainFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const limit = 9;

  const { data, isLoading, isError, error, refetch } = useElearningCourses({
    page,
    limit,
    domain: domainFilter || undefined,
    level: levelFilter || undefined,
    search: search || undefined,
  });

  const courses = data?.data ?? PLACEHOLDER_COURSES;
  const meta = data?.meta ?? {
    total: PLACEHOLDER_COURSES.length,
    page: 1,
    limit: 9,
  };
  const totalPages = Math.ceil(meta.total / meta.limit);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/knowledge"
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">E-Learning Catalog</h1>
          <p className="mt-1 text-sm text-gray-500">
            Courses and training modules for animal resources professionals
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search courses..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-aris-primary-500 focus:outline-none focus:ring-2 focus:ring-aris-primary-200"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={domainFilter}
            onChange={(e) => {
              setDomainFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none"
          >
            <option value="">All Domains</option>
            <option value="Platform">Platform</option>
            <option value="Animal Health">Animal Health</option>
            <option value="Data Quality">Data Quality</option>
            <option value="Fisheries">Fisheries</option>
            <option value="Trade & SPS">Trade & SPS</option>
            <option value="Wildlife">Wildlife</option>
            <option value="Production">Production</option>
            <option value="Governance">Governance</option>
          </select>
          <select
            value={levelFilter}
            onChange={(e) => {
              setLevelFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-aris-primary-500 focus:outline-none"
          >
            <option value="">All Levels</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
      </div>

      {/* Card Grid */}
      {isLoading ? (
        <TableSkeleton rows={6} cols={4} />
      ) : isError ? (
        <QueryError
          message={error instanceof Error ? error.message : 'Failed to load courses'}
          onRetry={() => refetch()}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <Link
                key={course.id}
                href={`/knowledge/elearning/${course.id}`}
                className="flex flex-col rounded-card border border-gray-200 bg-white p-4 hover:shadow-sm"
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
                  <span className="text-xs text-gray-400">{course.domain}</span>
                </div>
                <h3 className="mt-2 text-sm font-semibold text-gray-900 line-clamp-2">
                  {course.title}
                </h3>
                <p className="mt-1 flex-1 text-xs text-gray-500 line-clamp-2">
                  {course.description}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {course.instructor}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {course.durationMinutes >= 60
                      ? `${Math.floor(course.durationMinutes / 60)}h ${course.durationMinutes % 60 > 0 ? `${course.durationMinutes % 60}m` : ''}`
                      : `${course.durationMinutes}m`}
                  </span>
                  <span className="flex items-center gap-1">
                    <BookOpen className="h-3 w-3" />
                    {course.lessonsCount} lessons
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {course.enrolledCount.toLocaleString()} enrolled
                  </span>
                </div>
                <div className="mt-3 border-t border-gray-100 pt-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">Completion rate</span>
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
            {courses.length === 0 && (
              <div className="col-span-full py-12 text-center text-gray-400">
                No courses found
              </div>
            )}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between rounded-card border border-gray-200 bg-white px-4 py-3">
            <p className="text-xs text-gray-500">
              Showing {courses.length} of {meta.total} courses
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 text-xs text-gray-600">
                Page {page} of {totalPages || 1}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
