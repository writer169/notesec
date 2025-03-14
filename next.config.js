/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Disable automatic static optimization for pages that use authentication
  // This is crucial for pages that use useSession or session data
  experimental: {
    // Only enable necessary experimental features
  },
  // Add any other configuration here
  
  // Specify which pages to disable automatic static generation for
  unstable_runtimeJS: true,
}

module.exports = nextConfig
