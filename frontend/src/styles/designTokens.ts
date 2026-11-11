/**
 * Centralized Design System Tokens — TypeScript Reference
 * HRFlow AI — AI-Powered HR Operations Platform
 * Phase 1: Foundational Design Tokens & Login Experience
 */

export const designTokens = {
  colors: {
    // Primary Violet Palette
    primaryViolet: '#6938EF',
    secondaryViolet: '#8056F5',
    deepViolet: '#5425CB',
    violetHover: '#5425CB',
    violetActive: '#4319AB',

    // Lavender Surfaces & Backgrounds
    lightLavender: '#EDE7FF',
    softLavender: '#F5F1FF',
    lavenderBorder: '#DCD0FF',

    // Enterprise Neutrals
    appBg: '#F7F6FB',
    cardBg: '#FFFFFF',
    textPrimary: '#24212E',
    textSecondary: '#777387',
    textMuted: '#A09BAE',
    border: '#E7E3EF',

    // Semantic Colors
    success: '#16A36A',
    warning: '#E9A23B',
    danger: '#DC4545',
    info: '#4285D4',

    // Phase 2.1 Refined Shell Colors
    sidebarBg: '#EDE7F7',
    sidebarBorder: '#DCD5E8',
    sidebarText: '#292238',
    sidebarTextSecondary: '#625A70',
    sidebarSection: '#625078',

    workspaceBg: '#F5F3F9',
    workspaceHeader: '#F5F3F9',
    workspaceCard: '#FFFFFF',
    workspaceBorder: '#E1DBEA',

    navHover: '#E4DCF2',
    navActiveBg: '#DDD1FA',
    navActiveText: '#5425CB',
    navActiveBorder: '#6938EF',
  },
  typography: {
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    headings: {
      hero: 'font-bold text-3xl sm:text-4xl tracking-tight text-[#24212E]',
      h1: 'font-bold text-2xl sm:text-3xl tracking-tight text-[#24212E]',
      h2: 'font-semibold text-xl tracking-tight text-[#24212E]',
      h3: 'font-semibold text-base text-[#24212E]',
    },
    subtitles: {
      standard: 'text-sm text-[#777387] font-normal leading-relaxed',
      compact: 'text-xs text-[#777387] font-normal',
    },
    labels: {
      field: 'text-xs font-semibold text-[#24212E] tracking-normal mb-1.5',
      badge: 'text-xs font-medium tracking-wide',
    },
  },
  spacing: {
    xs: '0.25rem', // 4px
    sm: '0.5rem',  // 8px
    md: '1rem',    // 16px
    lg: '1.5rem',  // 24px
    xl: '2rem',    // 32px
    xxl: '3rem',   // 48px
  },
  radii: {
    sm: '0.375rem', // 6px
    md: '0.5rem',   // 8px (default input & button)
    lg: '0.75rem',  // 12px
    xl: '1rem',     // 16px (cards)
    full: '9999px',
  },
  shadows: {
    subtle: '0 1px 3px 0 rgba(36, 33, 46, 0.04), 0 1px 2px 0 rgba(36, 33, 46, 0.02)',
    card: '0 4px 20px -2px rgba(105, 56, 239, 0.08), 0 2px 6px -1px rgba(36, 33, 46, 0.04)',
    lavenderButton: '0 4px 14px 0 rgba(105, 56, 239, 0.35)',
    lavenderButtonHover: '0 6px 20px 0 rgba(105, 56, 239, 0.45)',
  },
  focusRings: {
    violet: 'focus:outline-none focus:ring-2 focus:ring-[#6938EF]/30 focus:border-[#6938EF]',
    button: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6938EF] focus-visible:ring-offset-2',
  },
  transitions: {
    standard: 'transition-all duration-200 ease-in-out',
    fast: 'transition-colors duration-150 ease-in-out',
  },
} as const;

export type DesignTokens = typeof designTokens;

