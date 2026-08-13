/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: '/weather',
        destination: '/labs/weather',
        permanent: true,
      },
      {
        source: '/autopilot',
        destination: '/labs/autopilot',
        permanent: true,
      },
      // Retired experiment surfaces (design alignment 2026-08-12): dead/404
      // routes fold into their living equivalents. Reversible on purpose.
      {
        source: '/month',
        destination: '/',
        permanent: false,
      },
      {
        source: '/world-cup',
        destination: '/proof',
        permanent: false,
      },
      // Agent surfaces unified under /arena (design alignment phase B):
      // the mandate cockpit lives as the Mandate lane.
      {
        source: '/agent',
        destination: '/arena?lane=mandate',
        permanent: false,
      },
      // Alerts folded into the Signals page as a tab — notifications are a
      // signal-side feature, not a standalone destination.
      {
        source: '/notifications',
        destination: '/signals?tab=alerts',
        permanent: false,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  experimental: {
    optimizePackageImports: ['connectkit', 'wagmi', 'viem'],
  },
  webpack: (config) => {
    // Ensure connectkit, wagmi, and viem load in the same chunk
    // Prevents "Cannot access 'W' before initialization" errors
    // caused by chunk loading race conditions
    if (config.optimization?.splitChunks?.cacheGroups) {
      config.optimization.splitChunks.cacheGroups.connectkit = {
        name: 'connectkit',
        test: /[\\/]node_modules[\\/](connectkit|wagmi|viem|@tanstack\/react-query)[\\/]/,
        chunks: 'all',
        priority: 40,
        enforce: true,
      };
    }
    // Suppress MetaMask SDK's optional React Native dependency warning
    config.resolve.alias = {
      ...config.resolve.alias,
      '@react-native-async-storage/async-storage': false,
    };
    return config;
  },
  // Turbopack config (Next.js 16 default bundler). Empty object silences the
  // "webpack config present but no turbopack config" build error. Turbopack
  // doesn't need the webpack splitChunks workaround.
  turbopack: {},
};

export default nextConfig;