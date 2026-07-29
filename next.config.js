/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ["localhost:3000"]
    },
    serverComponentsExternalPackages: ["pdf-parse", "pdfjs-dist", "tesseract.js"]
  }
};

export default nextConfig;
