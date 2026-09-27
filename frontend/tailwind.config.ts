import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    // Keep scanning limited to project source files.
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sora: ['Sora', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        'cng-green': '#22c55e',
        'cng-yellow': '#f59e0b',
        'cng-red': '#ef4444',
        'bg-primary': '#080a0f',
        'bg-secondary': '#0d1117',
        'bg-surface': '#141922',
        'bg-elevated': '#1a2332',
        'bg-card': '#1e2a3a',
        'text-primary': '#f0f4ff',
        'text-secondary': '#94a3b8',
        'text-muted': '#4b5e7a',
        'accent-blue': '#3b82f6',
        'accent-purple': '#8b5cf6',
        'accent-cyan': '#06b6d4',
      },
      borderRadius: {
        'sm': '0.75rem',
        'md': '1.25rem',
        'lg': '1.75rem',
        'xl': '2.5rem',
      },
      animation: {
        'pulse-ring': 'pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 3s ease-in-out infinite',
        'shimmer': 'shimmer 2.5s linear infinite',
        'slide-up': 'slide-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'fade-in': 'fade-in 0.4s ease forwards',
      },
    },
  },
  plugins: [],
};

export default config;
