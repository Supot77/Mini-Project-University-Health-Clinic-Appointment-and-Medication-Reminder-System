import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  allowedDevOrigins: [
    '10.107.0.46',
    '*.wu.ac.th',
    '*.trycloudflare.com',
    '*.loca.lt',
    'localhost',
    '127.0.0.1',
  ],
};

export default nextConfig;
