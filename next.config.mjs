/** @type {import('next').NextConfig} */
const nextConfig = {
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
    return config;
  },
};

export default nextConfig;
