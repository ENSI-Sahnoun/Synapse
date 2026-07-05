import { NextConfig } from "next";

const config: NextConfig = {
  // Barrel-import optimization: only pull the icons actually used into the
  // client bundle instead of the whole @phosphor-icons set. (lucide-react,
  // @heroicons, date-fns are already in Next's default optimize list.)
  experimental: {
    optimizePackageImports: ['@phosphor-icons/react'],
    // Client Router Cache: hold rendered segments in memory so returning to a
    // page (tab-switching in the PWA) is instant instead of re-running the full
    // dynamic server render. Default for dynamic is 0 = refetch every nav.
    // Realtime subscriptions + pull-to-refresh keep data fresh within the window.
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
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
