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
};

export default nextConfig;
