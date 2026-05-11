import type { Config } from 'tailwindcss'
import plugin from 'tailwindcss/plugin'

const config: Config = {
    content: [
        './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
        './src/components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            fontFamily: {
                display: ['Unbounded', 'sans-serif'],
                body: ['Golos Text', 'sans-serif'],
            },
            colors: {
                // New lime accent palette
                'accent': {
                    DEFAULT: '#c8f542',
                    50:  '#f7fee7',
                    100: '#edfcce',
                    200: '#dbf9a2',
                    300: '#c8f542',
                    400: '#b5e030',
                    500: '#9bc520',
                    600: '#7a9d18',
                    700: '#5c7714',
                    800: '#4a5f15',
                    900: '#3f5117',
                },
                // Background palette
                'bg-main':     '#0d0d0d',
                'bg-card':     '#141414',
                'bg-elevated': '#1a1a1a',
                'bg-section':  '#111111',
                // Legacy aliases for existing components
                'meta-orange': {
                    DEFAULT: '#c8f542',
                    50:  '#f7fee7',
                    100: '#edfcce',
                    200: '#dbf9a2',
                    300: '#c8f542',
                    400: '#b5e030',
                    500: '#9bc520',
                    600: '#7a9d18',
                    700: '#5c7714',
                    800: '#4a5f15',
                    900: '#3f5117',
                },
                'deep-dark': {
                    DEFAULT: '#0d0d0d',
                    50:  '#2a2a2a',
                    100: '#1a1a1a',
                    200: '#141414',
                    300: '#111111',
                    400: '#0f0f0f',
                    500: '#0d0d0d',
                    600: '#0a0a0a',
                    700: '#070707',
                    800: '#040404',
                    900: '#000000',
                },
                // Semantic colors
                'danger':  '#ff4d4d',
                'success': '#34d399',
                'warning': '#f5c842',
                'info':    '#60a5fa',
            },
            backdropBlur: {
                'glass': '20px',
            },
            boxShadow: {
                'glow-accent':    '0 0 30px rgba(200, 245, 66, 0.25)',
                'glow-accent-sm': '0 0 15px rgba(200, 245, 66, 0.15)',
                'glow-green':     '0 0 15px rgba(34, 197, 94, 0.2)',
                'glow-blue':      '0 0 15px rgba(59, 130, 246, 0.2)',
                'glow-danger':    '0 0 15px rgba(255, 77, 77, 0.2)',
                'glass':          '0 8px 32px rgba(0, 0, 0, 0.4)',
                // Legacy alias
                'glow-orange':    '0 0 30px rgba(200, 245, 66, 0.25)',
                'glow-orange-sm': '0 0 15px rgba(200, 245, 66, 0.15)',
            },
            borderRadius: {
                '4xl': '2rem',
            },
            animation: {
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'glow': 'glow 2s ease-in-out infinite alternate',
                'fade-in': 'fadeIn 0.3s ease-out',
                'slide-up': 'slideUp 0.3s ease-out',
            },
            keyframes: {
                glow: {
                    '0%': { boxShadow: '0 0 20px rgba(200, 245, 66, 0.15)' },
                    '100%': { boxShadow: '0 0 40px rgba(200, 245, 66, 0.3)' },
                },
                fadeIn: {
                    '0%': { opacity: '0', transform: 'translateY(-8px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                slideUp: {
                    '0%': { opacity: '0', transform: 'translateY(100%)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
            },
        },
    },
    plugins: [],
}

export default config
