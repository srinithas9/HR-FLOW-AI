/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        brand: {
          DEFAULT: '#5425CB', // Deep Violet matching Login Brand
          50: '#F5F1FF',
          100: '#EDE7FF',
          200: '#DCD0FF',
          300: '#C5B2FF',
          400: '#A68BF8',
          500: '#8056F5',
          600: '#6938EF',
          700: '#5425CB',
          800: '#4319AB',
          900: '#321484',
          950: '#1E162B',
        },
        action: {
          DEFAULT: '#2563EB', // Blue
          hover: '#1D4ED8',
          active: '#1E40AF',
          light: '#EFF6FF',
        },
        app: {
          bg: '#F5F7FB',
          surface: '#FFFFFF',
          border: '#E2E8F0',
        },
        // Premium Lavender Enterprise Design Tokens
        lavender: {
          50: '#F5F1FF',
          100: '#EDE7FF',
          200: '#DCD0FF',
          300: '#C5B2FF',
          400: '#A68BF8',
          500: '#8056F5', // Secondary Violet
          600: '#6938EF', // Primary Violet
          700: '#5425CB', // Deep Violet
          800: '#4319AB',
          900: '#321484',
        },
        enterprise: {
          'primary-violet': '#6938EF',
          'secondary-violet': '#8056F5',
          'deep-violet': '#5425CB',
          'light-lavender': '#EDE7FF',
          'soft-lavender': '#F5F1FF',
          'app-bg': '#F7F6FB',
          'card-bg': '#FFFFFF',
          'text-primary': '#24212E',
          'text-secondary': '#777387',
          'text-muted': '#A09BAE',
          border: '#E7E3EF',
          success: '#16A36A',
          warning: '#E9A23B',
          danger: '#DC4545',
          info: '#4285D4',
        },
        // Phase 2.1 Refined Application Shell Tokens
        shell: {
          'sidebar-bg': '#E6DFF2',
          'sidebar-surface': '#EDE7F7',
          'sidebar-border': '#D1C5E4',
          'sidebar-text': '#1E162B',
          'sidebar-text-secondary': '#5E4E7A',
          'sidebar-section': '#6D5D8A',
          'sidebar-hover': '#DAD0EC',
          'workspace-bg': '#F7F5FB',
          'workspace-header': '#FFFFFF',
          'workspace-card': '#FFFFFF',
          'workspace-border': '#E2DBEB',
          'nav-hover': '#DAD0EC',
          'nav-active-bg': '#FFFFFF',
          'nav-active-text': '#3B1599',
          'nav-active-border': '#5425CB',
          'text-primary': '#1E162B',
          'text-secondary': '#5C5270',
          'text-muted': '#827799',
        },
        text: {
          primary: '#172B4D',
          secondary: '#64748B',
          muted: '#94A3B8',
          inverted: '#FFFFFF',
        },
        status: {
          success: '#16A34A',
          'success-bg': '#F0FDF4',
          warning: '#D97706',
          'warning-bg': '#FFFBEB',
          danger: '#DC2626',
          'danger-bg': '#FEF2F2',
          info: '#0284C7',
          'info-bg': '#F0F9FF',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        subtle: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        card: '0 1px 3px 0 rgba(15, 23, 42, 0.06), 0 1px 2px 0 rgba(15, 23, 42, 0.04)',
        elevated: '0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -1px rgba(15, 23, 42, 0.04)',
        'lavender-sm': '0 2px 8px -1px rgba(105, 56, 239, 0.12)',
        'lavender-btn': '0 4px 14px 0 rgba(105, 56, 239, 0.35)',
        'lavender-card': '0 4px 24px -2px rgba(105, 56, 239, 0.08), 0 2px 8px -1px rgba(36, 33, 46, 0.04)',
        'lavender-hover': '0 8px 24px -2px rgba(105, 56, 239, 0.28)',
        'card-refined': '0 2px 12px rgba(49, 35, 75, 0.06)',
        'sidebar-refined': '2px 0 12px rgba(49, 35, 75, 0.04)',
      },
    },
  },
  plugins: [],
};

