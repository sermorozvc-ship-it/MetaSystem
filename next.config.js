/** @type {import('next').NextConfig} */
const nextConfig = {
    // Отключаем Strict Mode для предотвращения AbortError в Supabase Auth
    // Strict Mode вызывает двойной mount компонентов, что конфликтует с Web Locks API
    reactStrictMode: false,
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**',
            },
        ],
    },
};

module.exports = nextConfig;
