/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  
  // Disable static generation for pages that use client-side only libraries
  serverExternalPackages: [
    // Add packages that should only run on the client
    'wagmi',
    'connectkit',
    'aptos',
    'aptos-wallet-adapter',
    '@aptos-labs/wallet-adapter-react',
    '@aptos-labs/ts-sdk',
    'react-three',
    'three'
  ],
  
  // Enable Turbopack configuration
  turbopack: {},
};

export default nextConfig;