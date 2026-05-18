/** @type {import('next').NextConfig} */

// ⚠️ AJUSTE: nome EXATO do repositório no GitHub.
// Site fica em https://gzimmerdev.github.io/<REPO>/  → basePath precisa ser "/<REPO>".
// Se o repositório for "gzimmerdev.github.io" (site raiz), deixe REPO = "".
const REPO = 'USPDebate';

const isProd = process.env.NODE_ENV === 'production';
const base = isProd && REPO ? `/${REPO}` : '';

const nextConfig = {
  output: 'export',            // gera site estático em /out (GitHub Pages não roda Node)
  images: { unoptimized: true },
  basePath: base,
  assetPrefix: base || undefined,
  trailingSlash: true,
};

export default nextConfig;
