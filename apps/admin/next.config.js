/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@aris/ui-components', '@aris/shared-types'],
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
};

module.exports = nextConfig;
