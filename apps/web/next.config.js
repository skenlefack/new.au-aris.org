// i18n: Using client-side locale switching via Zustand store + custom translation system.
// For future server-side i18n, migrate to next-intl with middleware.

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@aris/ui-components', '@aris/shared-types'],
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  eslint: {
    // Linting is handled by the CI lint job (turbo lint).
    // Prevents ESLint errors from blocking production builds.
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
