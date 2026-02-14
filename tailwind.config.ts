import type { Config } from 'tailwindcss'

const config: Config = {
    content: [
        './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
        './src/components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            colors: {
                'meta-orange': {
                    DEFAULT: '#FF4500',
                    50: '#FFF0E6',
                    100: '#FFD6BF',
                    200: '#FFAB80',
                    300: '#FF8040',
                    400: '#FF5500',
                    500: '#FF4500',
                    600: '#E03D00',
                    700: '#B33100',
                    800: '#862500',
                    900: '#591800',
                },
                'deep-dark': {
                    DEFAULT: '#121212',
                    50: '#4A4A4A',
                    100: '#3A3A3A',
                    200: '#2A2A2A',
                    300: '#1E1E1E',
                    400: '#181818',
                    500: '#121212',
                    600: '#0E0E0E',
                    700: '#0A0A0A',
                    800: '#050505',
                    900: '#000000',
                },
            },
            backdropBlur: {
                'glass': '20px',
            },
            boxShadow: {
                'glow-orange': '0 0 30px rgba(255, 69, 0, 0.4)',
                'glow-orange-sm': '0 0 15px rgba(255, 69, 0, 0.3)',
                'glow-green': '0 0 15px rgba(34, 197, 94, 0.4)',
                'glow-blue': '0 0 15px rgba(59, 130, 246, 0.3)',
                'glass': '0 8px 32px rgba(0, 0, 0, 0.3)',
            },
            borderRadius: {
                '4xl': '2rem',
            },
            animation: {
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'glow': 'glow 2s ease-in-out infinite alternate',
            },
            keyframes: {
                glow: {
                    '0%': { boxShadow: '0 0 20px rgba(255, 69, 0, 0.3)' },
                    '100%': { boxShadow: '0 0 40px rgba(255, 69, 0, 0.6)' },
                },
            },
        },
    },
    plugins: [],
}

export default config
