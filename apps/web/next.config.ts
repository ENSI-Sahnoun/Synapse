import { NextConfig } from "next";

const config: NextConfig = {
  // Barrel-import optimization: only pull the icons actually used into the
  // client bundle instead of the whole @phosphor-icons set. (lucide-react,
  // @heroicons, date-fns are already in Next's default optimize list.)
  experimental: {
    optimizePackageImports: ['@phosphor-icons/react'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.unsplash.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
};


export default config;
