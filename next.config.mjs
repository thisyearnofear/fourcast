/** @type {import('next').NextConfig} */
const nextConfig = {
  // Turbopack-compatible config (empty object suppresses the warning)
  turbopack: {},
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      ws: false,
      'utf-8-validate': false,
      bufferutil: false,
    };
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

export default nextConfig;
