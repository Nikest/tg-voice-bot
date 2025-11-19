/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    experimental: {
        // Это нужно для некоторых старых версий, но в Next.js 14+ обычно не обязательно
        // outputFileTracingRoot: undefined,
    },
};
export default nextConfig;
