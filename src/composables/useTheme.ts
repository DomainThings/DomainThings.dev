/**
 * Vue 3 composable for managing semantic CSS theme classes.
 * Provides a consistent theming system similar to Vuetify's color variants
 * with automatic dark mode support via Tailwind CSS classes.
 */

export type ThemeVariant = 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral';
export type ThemeIntensity = 'light' | 'base' | 'dark';
export type ComponentType = 'button' | 'badge' | 'alert' | 'text' | 'border' | 'background';

/**
 * Complete theme class definition for a semantic variant.
 * Includes light mode, dark mode, and hover states for text, background, and border.
 */
interface ThemeClasses {
  readonly text: string;
  readonly background: string;
  readonly border: string;
  readonly hover: {
    readonly text: string;
    readonly background: string;
    readonly border: string;
  };
  readonly dark: {
    readonly text: string;
    readonly background: string;
    readonly border: string;
    readonly hover: {
      readonly text: string;
      readonly background: string;
      readonly border: string;
    };
  };
}

/**
 * Theme class definitions for each semantic variant.
 * Uses Tailwind CSS color palette with consistent naming convention:
 * - Light mode: 50-100 backgrounds, 200-300 borders, 700-800 text
 * - Dark mode: 900/20 backgrounds, 600-700 borders, 200-300 text
 */
const themeClasses: Record<ThemeVariant, ThemeClasses> = {
  primary: {
    text: 'text-primary-700',
    background: 'bg-primary-50',
    border: 'border-primary-200',
    hover: {
      text: 'hover:text-primary-800',
      background: 'hover:bg-primary-100',
      border: 'hover:border-primary-300',
    },
    dark: {
      text: 'dark:text-primary-300',
      background: 'dark:bg-primary-900/20',
      border: 'dark:border-primary-700',
      hover: {
        text: 'dark:hover:text-primary-200',
        background: 'dark:hover:bg-primary-800/30',
        border: 'dark:hover:border-primary-600',
      },
    },
  },
  success: {
    text: 'text-success-700',
    background: 'bg-success-50',
    border: 'border-success-200',
    hover: {
      text: 'hover:text-success-800',
      background: 'hover:bg-success-100',
      border: 'hover:border-success-300',
    },
    dark: {
      text: 'dark:text-success-300',
      background: 'dark:bg-success-900/20',
      border: 'dark:border-success-700',
      hover: {
        text: 'dark:hover:text-success-200',
        background: 'dark:hover:bg-success-800/30',
        border: 'dark:hover:border-success-600',
      },
    },
  },
  warning: {
    text: 'text-warning-700',
    background: 'bg-warning-50',
    border: 'border-warning-200',
    hover: {
      text: 'hover:text-warning-800',
      background: 'hover:bg-warning-100',
      border: 'hover:border-warning-300',
    },
    dark: {
      text: 'dark:text-warning-300',
      background: 'dark:bg-warning-900/20',
      border: 'dark:border-warning-700',
      hover: {
        text: 'dark:hover:text-warning-200',
        background: 'dark:hover:bg-warning-800/30',
        border: 'dark:hover:border-warning-600',
      },
    },
  },
  error: {
    text: 'text-error-700',
    background: 'bg-error-50',
    border: 'border-error-200',
    hover: {
      text: 'hover:text-error-800',
      background: 'hover:bg-error-100',
      border: 'hover:border-error-300',
    },
    dark: {
      text: 'dark:text-error-300',
      background: 'dark:bg-error-900/20',
      border: 'dark:border-error-700',
      hover: {
        text: 'dark:hover:text-error-200',
        background: 'dark:hover:bg-error-800/30',
        border: 'dark:hover:border-error-600',
      },
    },
  },
  info: {
    text: 'text-info-700',
    background: 'bg-info-50',
    border: 'border-info-200',
    hover: {
      text: 'hover:text-info-800',
      background: 'hover:bg-info-100',
      border: 'hover:border-info-300',
    },
    dark: {
      text: 'dark:text-info-300',
      background: 'dark:bg-info-900/20',
      border: 'dark:border-info-700',
      hover: {
        text: 'dark:hover:text-info-200',
        background: 'dark:hover:bg-info-800/30',
        border: 'dark:hover:border-info-600',
      },
    },
  },
  neutral: {
    text: 'text-neutral-700',
    background: 'bg-neutral-50',
    border: 'border-neutral-200',
    hover: {
      text: 'hover:text-neutral-800',
      background: 'hover:bg-neutral-100',
      border: 'hover:border-neutral-300',
    },
    dark: {
      text: 'dark:text-neutral-300',
      background: 'dark:bg-neutral-800',
      border: 'dark:border-neutral-700',
      hover: {
        text: 'dark:hover:text-neutral-200',
        background: 'dark:hover:bg-neutral-700',
        border: 'dark:hover:border-neutral-600',
      },
    },
  },
};

/**
 * Main composable for accessing theme utilities.
 * Provides methods to generate CSS classes for different component types
 * with consistent theming and dark mode support.
 */
export function useTheme() {
  
  /**
   * Generate CSS classes for badge/chip components.
   * Returns a space-separated string of Tailwind classes including:
   * - Base styling (rounded, padding, text size)
   * - Theme colors (text, background, border)
   * - Dark mode variants
   */
  const getBadgeClasses = (variant: ThemeVariant = 'neutral'): string => {
    const theme = themeClasses[variant];
    return [
      'rounded-lg text-xs px-2 py-1',
      theme.text,
      theme.background,
      theme.border,
      'border',
      theme.dark.text,
      theme.dark.background,
      theme.dark.border,
    ].join(' ');
  };

  /**
   * Generate CSS classes for button components.
   * @param variant - Semantic color variant
   * @param outline - Whether to use outline style (transparent background)
   * @param border - Whether to include border styling
   * @returns Space-separated string of Tailwind CSS classes
   */
  const getButtonClasses = (variant: ThemeVariant = 'neutral', outline: boolean = false, border: boolean = true): string => {
    const theme = themeClasses[variant];
    
    // Outline style: transparent background with colored text and border
    if (outline) {
      return [
        'rounded-lg text-xs px-2 py-1 cursor-pointer',
        theme.text,
        'bg-transparent',
        border ? 'border' : '',
        border ? theme.border : '',
        theme.hover.text,
        theme.hover.background,
        theme.hover.border,
        theme.dark.text,
        theme.dark.border,
        theme.dark.hover.text,
        theme.dark.hover.background,
        theme.dark.hover.border,
        'transition-colors',
      ].filter(Boolean).join(' ');
    }

    // Filled style: colored background with matching text and border
    return [
      'rounded-lg text-xs px-2 py-1 cursor-pointer',
      theme.text,
      theme.background,
      border ? 'border' : '',
      border ? theme.border : '',
      theme.hover.text,
      theme.hover.background,
      theme.hover.border,
      theme.dark.text,
      theme.dark.background,
      theme.dark.border,
      theme.dark.hover.text,
      theme.dark.hover.background,
      theme.dark.hover.border,
      'transition-colors',
    ].filter(Boolean).join(' ');
  };

  /**
   * Generate CSS classes for alert/notification components.
   * @param variant - Semantic color variant (defaults to 'info')
   * @returns Space-separated string of Tailwind CSS classes
   */
  const getAlertClasses = (variant: ThemeVariant = 'info'): string => {
    const theme = themeClasses[variant];
    return [
      'rounded-lg p-4 border',
      theme.text,
      theme.background,
      theme.border,
      theme.dark.text,
      theme.dark.background,
      theme.dark.border,
    ].join(' ');
  };

  /**
   * Generate CSS classes for semantic text styling.
   * @param variant - Semantic color variant
   * @returns Space-separated string of text color classes
   */
  const getTextClasses = (variant: ThemeVariant): string => {
    const theme = themeClasses[variant];
    return [
      theme.text,
      theme.dark.text,
    ].join(' ');
  };

  /**
   * Generate CSS classes for icon components with semantic colors.
   * Automatically provides both text-* and fill-* classes for SVG icons.
   * @param variant - Semantic color variant  
   * @returns Space-separated string of text and fill color classes
   */
  const getIconClasses = (variant: ThemeVariant): string => {
    const theme = themeClasses[variant];

    // Generate both text and fill classes for comprehensive SVG icon support
    const textLight = theme.text;
    const textDark = theme.dark.text;
    const fillLight = theme.text.replace('text-', 'fill-');
    const fillDark = theme.dark.text.replace('dark:text-', 'dark:fill-');

    return [
      textLight,
      textDark,
      fillLight,
      fillDark,
    ].join(' ');
  };

  /**
   * Get a specific CSS class for fine-grained control.
   * Useful when you need individual theme properties rather than complete class sets.
   * @param variant - Semantic color variant
   * @param type - Type of CSS property to retrieve
   * @param isDark - Whether to get dark mode variant
   * @returns Single Tailwind CSS class string
   */
  const getClass = (variant: ThemeVariant, type: 'text' | 'background' | 'border', isDark = false): string => {
    const theme = themeClasses[variant];
    return isDark ? theme.dark[type] : theme[type];
  };

  return {
    getBadgeClasses,
    getButtonClasses,
    getAlertClasses,
    getTextClasses,
    getIconClasses,
    getClass,
    themeClasses,
  };
}
