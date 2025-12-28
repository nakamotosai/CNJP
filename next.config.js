/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        unoptimized: true,
    },
    async rewrites() {
        return [
            {
                source: '/r2-proxy/:path*',
                destination: 'https://r2.cn.saaaai.com/:path*',
            },
        ];
    },
};

module.exports = nextConfig;
