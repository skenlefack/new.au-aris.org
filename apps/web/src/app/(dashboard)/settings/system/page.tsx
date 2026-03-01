'use client';

import React from 'react';
import { Server, Download, Upload, Activity, Database, Cpu } from 'lucide-react';

export default function SystemInfoPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">System Info</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Platform version, health status, and configuration management
        </p>
      </div>

      {/* Version info */}
      <div className="grid gap-4 sm:grid-cols-3">
        <InfoCard icon={<Server className="h-5 w-5" />} label="Version" value="3.0.0-rc1" color="#006B3F" />
        <InfoCard icon={<Database className="h-5 w-5" />} label="Services" value="22 Active" color="#1565C0" />
        <InfoCard icon={<Activity className="h-5 w-5" />} label="Status" value="Healthy" color="#2E7D32" />
      </div>

      {/* Stack */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Technology Stack</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {STACK_ITEMS.map(({ label, value }) => (
            <div key={label} className="flex justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-900/50">
              <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
              <span className="text-xs font-medium text-gray-900 dark:text-white">{value}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Config Export/Import */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Configuration Management</h2>
        <div className="flex gap-3">
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <Download className="h-4 w-4" />
            Export Config (JSON)
          </button>
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <Upload className="h-4 w-4" />
            Import Config
          </button>
        </div>
      </section>

      {/* Services health */}
      <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Service Health</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((svc) => (
            <div key={svc.name} className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-900/50">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-medium text-gray-900 dark:text-white">{svc.name}</span>
              <span className="ml-auto text-[10px] text-gray-400">:{svc.port}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function InfoCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}14`, color }}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-sm font-bold text-gray-900 dark:text-white">{value}</p>
      </div>
    </div>
  );
}

const STACK_ITEMS = [
  { label: 'Runtime', value: 'Node.js 22 LTS' },
  { label: 'Backend', value: 'Fastify + NestJS' },
  { label: 'Frontend', value: 'Next.js 14' },
  { label: 'Database', value: 'PostgreSQL 16 + PostGIS' },
  { label: 'ORM', value: 'Prisma 6.2' },
  { label: 'Cache', value: 'Redis 7' },
  { label: 'Message Broker', value: 'Kafka 3.7 KRaft' },
  { label: 'Search', value: 'Elasticsearch 8' },
  { label: 'Object Storage', value: 'MinIO (S3)' },
  { label: 'Proxy', value: 'PgBouncer + Traefik' },
  { label: 'Monitoring', value: 'Prometheus + Grafana' },
  { label: 'Auth', value: 'JWT RS256' },
];

const SERVICES = [
  { name: 'Tenant', port: 3001 },
  { name: 'Credential', port: 3002 },
  { name: 'Master Data', port: 3003 },
  { name: 'Data Quality', port: 3004 },
  { name: 'Data Contract', port: 3005 },
  { name: 'Message', port: 3006 },
  { name: 'Drive', port: 3007 },
  { name: 'Realtime', port: 3008 },
  { name: 'Form Builder', port: 3010 },
  { name: 'Collecte', port: 3011 },
  { name: 'Workflow', port: 3012 },
  { name: 'Animal Health', port: 3020 },
  { name: 'Livestock Prod', port: 3021 },
  { name: 'Fisheries', port: 3022 },
  { name: 'Wildlife', port: 3023 },
  { name: 'Apiculture', port: 3024 },
  { name: 'Trade & SPS', port: 3025 },
  { name: 'Governance', port: 3026 },
  { name: 'Climate & Env', port: 3027 },
  { name: 'Analytics', port: 3030 },
  { name: 'Geo Services', port: 3031 },
  { name: 'Knowledge Hub', port: 3033 },
];
