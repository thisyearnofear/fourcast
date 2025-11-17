/** @type {import('next').NextConfig} */
const nextConfig = {
  // Optimize images
  images: {
    formats: ['image/webp', 'image/avif'],
  },

  // Enable compression
  compress: true,

  // Performance optimizations
  experimental: {
    // Enable scroll restoration
    scrollRestoration: true,
  },

  // Headers for better caching and security
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=300, s-maxage=600',
          },
        ],
      },
    ];
  },

  // Webpack configuration
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Disable split chunks for server to avoid self reference issues
      config.optimization = {
        ...config.optimization,
        splitChunks: false,
        runtimeChunk: false,
      };
    } else {
      // For client build, handle Node.js built-ins that Redis or other server modules might need
      config.resolve = {
        ...config.resolve,
        fallback: {
          ...config.resolve?.fallback,
          '@react-native-async-storage/async-storage': false,
          fs: false,
          net: false,
          tls: false,
          dns: false,
          assert: false,
          crypto: false,
          stream: false,
          util: false,
          path: false,
          os: false,
          http: false,
          https: false,
          zlib: false,
          buffer: false,
          // Handle better-sqlite3 which is a native module that can't be bundled for client
          'better-sqlite3': false,
          // Exclude redis and server-only modules from client bundle
          redis: false,
          '../services/redisService': false,
          './services/redisService': false,
          '@/services/redisService': false,
          'node:assert': false,
          'node:crypto': false,
          'node:events': false,
          'node:diagnostics_channel': false,
          'node:net': false,
          'node:tls': false,
          'node:dns': false,
          'node:http': false,
          'node:https': false,
          'node:stream': false,
          'node:util': false,
          'node:zlib': false,
          'node:buffer': false,
        },
      };
    }
    return config;
  },
};

export default nextConfig;
