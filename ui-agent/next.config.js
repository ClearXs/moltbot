/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["lucide-react"],
  async rewrites() {
    // Use environment variable for backend URL, default to localhost:8000
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:18789";

    return [
      {
        source: "/api/tools/invoke",
        destination: `${backendUrl}/tools/invoke`,
      },
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
      {
        // Proxy /files/ requests to backend workspace files
        source: "/files/:path*",
        destination: `${backendUrl}/files/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
