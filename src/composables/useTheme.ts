/**
 * Composable pour gérer les classes CSS thématiques de manière sémantique
 * Similaire aux couleurs Vuetify (primary, success, warning, error, info)
 */

export type ThemeVariant = 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral';
export type ThemeIntensity = 'light' | 'base' | 'dark';
export type ComponentType = 'button' | 'badge' | 'alert' | 'text' | 'border' | 'background';

interface ThemeClasses {
  text: string;
  background: string;
  border: string;
  hover: {
    text: string;
    background: string;
    border: string;
  };
  dark: {
    text: string;
    background: string;
    border: string;
    hover: {
      text: string;
      background: string;
      border: string;
    };
  };
}

/**
 * Définition des classes CSS pour chaque variante thématique
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
 * Composable principal pour utiliser les classes thématiques
 */
export function useTheme() {
  
  /**
   * Obtenir les classes CSS pour un composant de type badge/chip
   */
  const getBadgeClasses = (variant: ThemeVariant = 'neutral') => {
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
   * Obtenir les classes CSS pour un bouton
   */
  const getButtonClasses = (variant: ThemeVariant = 'neutral', outline: boolean = false, border: boolean = true) => {
    const theme = themeClasses[variant];
    
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
      ].join(' ');
    }

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
    ].join(' ');
  };

  /**
   * Obtenir les classes CSS pour une alerte
   */
  const getAlertClasses = (variant: ThemeVariant = 'info') => {
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
   * Obtenir les classes CSS pour du texte sémantique
   */
  const getTextClasses = (variant: ThemeVariant) => {
    const theme = themeClasses[variant];
    return [
      theme.text,
      theme.dark.text,
    ].join(' ');
  };

  /**
   * Obtenir les classes CSS pour les icônes avec couleurs sémantiques
   * Retourne automatiquement les classes text-* et fill-* pour la variante donnée
   */
  const getIconClasses = (variant: ThemeVariant) => {
    const theme = themeClasses[variant];

    // Générer les classes text et fill automatiquement
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
   * Obtenir une classe CSS spécifique
   */
  const getClass = (variant: ThemeVariant, type: 'text' | 'background' | 'border', isDark = false) => {
    const theme = themeClasses[variant];
    if (isDark) {
      return theme.dark[type];
    }
    return theme[type];
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
