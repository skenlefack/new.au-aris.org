// i18n: Using client-side locale switching via Zustand store + custom translation system.
// For future server-side i18n, migrate to next-intl with middleware.

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@aris/ui-components', '@aris/shared-types'],
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  eslint: {
    // Linting is handled by the CI lint job (turbo lint).
    // Prevents ESLint errors from blocking production builds.
    ignoreDuringBuilds: true,
  },

  // ─── Dev proxy: route API calls to the correct backend service ─────────────
  // In production Traefik handles routing — rewrites are NOT needed.
  // In dev, Next.js rewrites act as proxy so the browser stays same-origin.
  async rewrites() {
    // In production (standalone), Traefik handles all /api/v1/* routing.
    // Rewrites would fail because localhost services don't exist inside the container.
    if (process.env.NODE_ENV === 'production') {
      return [];
    }

    const svc = (name, port) => process.env[`SERVICE_${name}_URL`] || `http://localhost:${port}`;

    return [
      // ── Platform services ──
      { source: '/api/v1/credential/:path*',     destination: `${svc('CREDENTIAL', 3002)}/api/v1/credential/:path*` },
      { source: '/api/v1/tenants/:path*',         destination: `${svc('TENANT', 3001)}/api/v1/tenants/:path*` },
      { source: '/api/v1/tenants',                destination: `${svc('TENANT', 3001)}/api/v1/tenants` },
      { source: '/api/v1/messages/:path*',        destination: `${svc('MESSAGE', 3006)}/api/v1/messages/:path*` },
      { source: '/api/v1/drive/:path*',           destination: `${svc('DRIVE', 3007)}/api/v1/drive/:path*` },

      // ── Data Hub ──
      { source: '/api/v1/master-data/:path*',     destination: `${svc('MASTER_DATA', 3003)}/api/v1/master-data/:path*` },
      { source: '/api/v1/data-quality/:path*',    destination: `${svc('DATA_QUALITY', 3004)}/api/v1/data-quality/:path*` },
      { source: '/api/v1/data-contract/:path*',   destination: `${svc('DATA_CONTRACT', 3005)}/api/v1/data-contract/:path*` },

      // ── Collecte & Workflow ──
      { source: '/api/v1/form-builder/:path*',    destination: `${svc('FORM_BUILDER', 3010)}/api/v1/form-builder/:path*` },
      { source: '/api/v1/collecte/:path*',        destination: `${svc('COLLECTE', 3011)}/api/v1/collecte/:path*` },
      { source: '/api/v1/workflow/:path*',        destination: `${svc('WORKFLOW', 3012)}/api/v1/workflow/:path*` },

      // ── Domain services ──
      { source: '/api/v1/animal-health/:path*',   destination: `${svc('ANIMAL_HEALTH', 3020)}/api/v1/animal-health/:path*` },
      { source: '/api/v1/livestock/:path*',       destination: `${svc('LIVESTOCK', 3021)}/api/v1/livestock/:path*` },
      { source: '/api/v1/fisheries/:path*',       destination: `${svc('FISHERIES', 3022)}/api/v1/fisheries/:path*` },
      { source: '/api/v1/wildlife/:path*',        destination: `${svc('WILDLIFE', 3023)}/api/v1/wildlife/:path*` },
      { source: '/api/v1/apiculture/:path*',      destination: `${svc('APICULTURE', 3024)}/api/v1/apiculture/:path*` },
      { source: '/api/v1/trade/:path*',           destination: `${svc('TRADE', 3025)}/api/v1/trade/:path*` },
      { source: '/api/v1/governance/:path*',      destination: `${svc('GOVERNANCE', 3026)}/api/v1/governance/:path*` },
      { source: '/api/v1/climate/:path*',         destination: `${svc('CLIMATE', 3027)}/api/v1/climate/:path*` },

      // ── Analytics & Integration ──
      { source: '/api/v1/analytics/:path*',       destination: `${svc('ANALYTICS', 3030)}/api/v1/analytics/:path*` },
      { source: '/api/v1/geo/:path*',             destination: `${svc('GEO', 3031)}/api/v1/geo/:path*` },
      { source: '/api/v1/interop-hub/:path*',     destination: `${svc('INTEROP_HUB', 3032)}/api/v1/interop-hub/:path*` },
      { source: '/api/v1/knowledge/:path*',       destination: `${svc('KNOWLEDGE', 3033)}/api/v1/knowledge/:path*` },

      // ── BI Tools ──
      // Metabase proxy is handled by API route handler at /api/bi-proxy/metabase/[...path]

      // ── Tenant / BI routes ──
      { source: '/api/v1/bi/:path*',              destination: `${svc('TENANT', 3001)}/api/v1/bi/:path*` },
    ];
  },
};

module.exports = nextConfig;
