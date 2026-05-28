import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // Any asset URL that looks like /uploads/<filename> is served by
      // the runtime file handler. Files written to public/uploads after
      // `next build` are not picked up by the static handler, so we
      // always go through the API route.
      { source: "/uploads/:filename", destination: "/api/uploads/:filename" },
    ];
  },
};

export default nextConfig;
