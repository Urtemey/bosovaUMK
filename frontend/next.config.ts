import type { NextConfig } from "next";

const apiOrigin = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/content-images/:path*',
        destination: `${apiOrigin}/content-images/:path*`,
      },
    ];
  },
};

export default nextConfig;
