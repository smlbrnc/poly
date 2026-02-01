/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: true },
  webpack: (config) => {
    config.resolve.extensionAlias = { ".js": [".ts", ".js"] };
    return config;
  },
};
export default nextConfig;
