import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Permissions now live inside Roles & Permissions.
      { source: "/admin/permissions", destination: "/admin/roles", permanent: true },
    ];
  },
};

export default nextConfig;
