/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // macOS-like colors
        macos: {
          bg: '#f5f5f7',
          'bg-dark': '#1c1c1e',
          surface: 'rgba(255, 255, 255, 0.8)',
          'surface-dark': 'rgba(44, 44, 46, 0.8)',
          blue: '#007aff',
          red: '#ff3b30',
          orange: '#ff9500',
          yellow: '#ffcc00',
          green: '#34c759',
          gray: {
            100: '#f5f5f7',
            200: '#e5e5ea',
            300: '#d1d1d6',
            400: '#c7c7cc',
            500: '#a8a8ad',
            600: '#8e8e93',
            700: '#636366',
            800: '#48484a',
            900: '#3a3a3c',
          },
          sidebar: 'rgba(236, 236, 240, 0.85)',
          'sidebar-dark': 'rgba(30, 30, 32, 0.85)',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', '"SF Pro Text"', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        mono: ['"SF Mono"', '"Fira Code"', '"Fira Mono"', 'Menlo', 'Monaco', 'monospace'],
      },
      backdropBlur: {
        xs: '2px',
        '2xl': '40px',
      },
      borderRadius: {
        'apple': '10px',
        'apple-lg': '14px',
        'apple-xl': '20px',
      },
      boxShadow: {
        'apple': '0 0 0 0.5px rgba(0, 0, 0, 0.04), 0 4px 12px 0 rgba(0, 0, 0, 0.08), 0 2px 4px 0 rgba(0, 0, 0, 0.04)',
        'apple-lg': '0 0 0 0.5px rgba(0, 0, 0, 0.04), 0 8px 24px 0 rgba(0, 0, 0, 0.12), 0 4px 8px 0 rgba(0, 0, 0, 0.04)',
        'apple-xl': '0 0 0 0.5px rgba(0, 0, 0, 0.04), 0 16px 48px 0 rgba(0, 0, 0, 0.16), 0 8px 16px 0 rgba(0, 0, 0, 0.04)',
        'apple-inner': 'inset 0 0 0 0.5px rgba(0, 0, 0, 0.08)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
}