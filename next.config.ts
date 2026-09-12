import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Host del catálogo demo que siembra `db:seed` (004 §8.5). Un `image_url`
    // de admin con otro proveedor se sigue mostrando (`src/lib/image.ts`
    // marca esos casos `unoptimized`); este allowlist solo decide qué fotos
    // pasan por el optimizador de `next/image`, no cuáles son visibles.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
