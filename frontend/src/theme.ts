import { theme as antdAlgorithms, type ThemeConfig } from 'antd';

/**
 * Design tokens of the system. Every screen takes colors, type, spacing, radii and
 * shadows from here; Ant Design receives the same values through `antdTheme`.
 *
 * Colors come in two schemes: the dark one is the app theme (deep navy with the institutional
 * blue as accent) and the light one is kept for paper (the A4 project report, on screen and
 * printed). Screens use `colors`, `tones`, `iconTones` and `shadows`, which are CSS variables
 * (var(--...)) set by GlobalStyle: the same component follows whichever scheme is active where
 * it is drawn, without knowing which one it is.
 */

/** Brand and neutral palette (navy and institutional blue identity), as raw values. */
export const palette = {
  navy950: '#081C36',
  navy900: '#0B2A4A',
  navy800: '#0F3157',
  navy700: '#12365C',
  navy500: '#2A4D74',
  blue600: '#1E6BE6',
  blue700: '#1858C2',
  blue100: '#C9DBF8',
  blue50: '#E8F0FD',
  gray900: '#0F1E33',
  gray600: '#4A5B70',
  gray500: '#7A8899',
  gray300: '#CBD5E1',
  gray200: '#E3E8EF',
  gray100: '#EEF1F5',
  gray75: '#F3F5F8',
  gray50: '#F3F6FB',
  gray25: '#F8FAFC',
  white: '#FFFFFF',
} as const;

export type Tone = 'danger' | 'warning' | 'info' | 'success' | 'neutral';
/** Soft colored circles behind the icons of indicators and list items. */
export type IconTone = 'blue' | 'green' | 'orange' | 'purple' | 'red' | 'gray';

type ToneSet = { fg: string; bg: string; border: string; solid: string };

interface Scheme {
  base: {
    bgApp: string;
    bgCard: string;
    bgSubtle: string;
    bgMuted: string;
    /** Strong text: page and card titles (dark navy on paper, near white on the dark theme). */
    navy: string;
    navyDark: string;
    blue: string;
    blueHover: string;
    blueSelected: string;
    textDark: string;
    textMuted: string;
    textSubtle: string;
    border: string;
    borderStrong: string;
    /** Background of floating panels (dropdowns, popovers, modals). */
    bgElevated: string;
  };
  tones: Record<Tone, ToneSet>;
  iconTones: Record<IconTone, { fg: string; bg: string }>;
  shadows: { sm: string; md: string; lg: string };
  /** Side menu and global header. */
  chrome: {
    siderBg: string;
    siderBgEnd: string;
    siderText: string;
    siderTextMuted: string;
    siderHover: string;
    siderBorder: string;
    headerBg: string;
  };
}

/** Paper: the previous light look, kept for the A4 report on screen and for printing. */
const lightScheme: Scheme = {
  base: {
    bgApp: palette.gray50,
    bgCard: palette.white,
    bgSubtle: palette.gray25,
    bgMuted: palette.gray100,
    navy: palette.navy900,
    navyDark: palette.navy700,
    blue: palette.blue600,
    blueHover: palette.blue700,
    blueSelected: palette.blue50,
    textDark: palette.gray900,
    textMuted: palette.gray600,
    textSubtle: palette.gray500,
    border: palette.gray200,
    borderStrong: palette.gray300,
    bgElevated: palette.white,
  },
  tones: {
    danger: { fg: '#C2362B', bg: '#FDECEA', border: '#F4C7C2', solid: '#C2362B' },
    warning: { fg: '#A35F00', bg: '#FFF3DF', border: '#F5D9A8', solid: '#D98A0B' },
    info: { fg: palette.blue600, bg: palette.blue50, border: palette.blue100, solid: palette.blue600 },
    success: { fg: '#1E7F4F', bg: '#E6F4EC', border: '#BFE3CE', solid: '#1E7F4F' },
    neutral: { fg: palette.gray600, bg: palette.gray100, border: palette.gray200, solid: '#C3CDD9' },
  },
  iconTones: {
    blue: { fg: palette.blue600, bg: '#E7F0FE' },
    green: { fg: '#16A34A', bg: '#E5F6EC' },
    orange: { fg: '#EA8A0C', bg: '#FFF1DE' },
    purple: { fg: '#7C4DDB', bg: '#EFE8FC' },
    red: { fg: '#D64545', bg: '#FDECEC' },
    gray: { fg: palette.gray600, bg: palette.gray100 },
  },
  shadows: {
    sm: '0 1px 3px rgba(15, 30, 51, 0.05), 0 4px 12px -6px rgba(15, 30, 51, 0.08)',
    md: '0 4px 12px -2px rgba(15, 30, 51, 0.10), 0 2px 4px -2px rgba(15, 30, 51, 0.06)',
    lg: '0 12px 28px -8px rgba(15, 30, 51, 0.18), 0 4px 8px -4px rgba(15, 30, 51, 0.08)',
  },
  chrome: {
    siderBg: palette.navy900,
    siderBgEnd: palette.navy950,
    siderText: '#C9D5E3',
    siderTextMuted: 'rgba(201, 213, 227, 0.7)',
    siderHover: 'rgba(255, 255, 255, 0.06)',
    siderBorder: 'rgba(255, 255, 255, 0.1)',
    headerBg: 'rgba(255, 255, 255, 0.92)',
  },
};

/** App theme: dark navy surfaces, light text and the institutional blue (a touch brighter) as accent. */
const darkScheme: Scheme = {
  base: {
    bgApp: '#0B111B',
    bgCard: '#121A27',
    bgSubtle: '#161F2E',
    bgMuted: '#1C2636',
    navy: '#EEF2F8',
    navyDark: '#DCE4EF',
    blue: '#3B82F6',
    blueHover: '#60A0FA',
    blueSelected: 'rgba(59, 130, 246, 0.16)',
    textDark: '#D8DFE8',
    textMuted: '#9AA6B8',
    textSubtle: '#76839A',
    border: '#232E40',
    borderStrong: '#33415A',
    bgElevated: '#182233',
  },
  tones: {
    danger: { fg: '#F2867B', bg: 'rgba(239, 83, 80, 0.14)', border: 'rgba(239, 83, 80, 0.34)', solid: '#E5534B' },
    warning: { fg: '#F2B65A', bg: 'rgba(242, 170, 60, 0.14)', border: 'rgba(242, 170, 60, 0.34)', solid: '#E59A2E' },
    info: { fg: '#7EB0FA', bg: 'rgba(59, 130, 246, 0.16)', border: 'rgba(59, 130, 246, 0.38)', solid: '#3B82F6' },
    success: { fg: '#5CC98F', bg: 'rgba(52, 190, 120, 0.14)', border: 'rgba(52, 190, 120, 0.34)', solid: '#2FA36B' },
    neutral: { fg: '#A9B4C4', bg: 'rgba(148, 163, 184, 0.12)', border: 'rgba(148, 163, 184, 0.24)', solid: '#5B677A' },
  },
  iconTones: {
    blue: { fg: '#6EA5FA', bg: 'rgba(59, 130, 246, 0.16)' },
    green: { fg: '#4CC985', bg: 'rgba(46, 180, 110, 0.15)' },
    orange: { fg: '#F5A742', bg: 'rgba(245, 158, 11, 0.15)' },
    purple: { fg: '#A78BFA', bg: 'rgba(139, 92, 246, 0.16)' },
    red: { fg: '#F27C72', bg: 'rgba(239, 68, 68, 0.15)' },
    gray: { fg: '#A3AFBF', bg: 'rgba(148, 163, 184, 0.12)' },
  },
  shadows: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.35), 0 4px 12px -6px rgba(0, 0, 0, 0.45)',
    md: '0 6px 16px -4px rgba(0, 0, 0, 0.5), 0 2px 4px -2px rgba(0, 0, 0, 0.35)',
    lg: '0 16px 40px -12px rgba(0, 0, 0, 0.65), 0 4px 8px -4px rgba(0, 0, 0, 0.4)',
  },
  chrome: {
    siderBg: '#0A1019',
    siderBgEnd: '#070C14',
    siderText: '#C3CDDA',
    siderTextMuted: 'rgba(195, 205, 218, 0.6)',
    siderHover: 'rgba(255, 255, 255, 0.06)',
    siderBorder: '#1A2333',
    headerBg: 'rgba(11, 17, 27, 0.86)',
  },
};

// ── variáveis CSS ───────────────────────────────────────────────────────────────────────────

type Nested = { [key: string]: string | Nested };

/** `--prefix-key: value;` for every leaf of a scheme part. */
function declarations(values: Nested, prefix: string): string[] {
  return Object.entries(values).flatMap(([key, value]) => (typeof value === 'string' ? [`--${prefix}-${key}: ${value};`] : declarations(value, `${prefix}-${key}`)));
}

/** The same shape, with each leaf replaced by its CSS variable. */
function references<T>(values: T, prefix: string): T {
  return Object.fromEntries(
    Object.entries(values as Nested).map(([key, value]) => [key, typeof value === 'string' ? `var(--${prefix}-${key})` : references(value, `${prefix}-${key}`)]),
  ) as T;
}

function schemeCss(scheme: Scheme): string {
  return [
    ...declarations(scheme.base, 'c'),
    ...declarations(scheme.tones, 't'),
    ...declarations(scheme.iconTones, 'i'),
    ...declarations(scheme.shadows, 's'),
    ...declarations(scheme.chrome, 'x'),
  ].join('\n');
}

/** CSS declarations of each scheme (used by GlobalStyle). */
export const SCHEME_CSS = { dark: schemeCss(darkScheme), light: schemeCss(lightScheme) } as const;

/** Class that brings back the light scheme inside it (paper: the A4 report). */
export const LIGHT_SURFACE_CLASS = 'light-surface';

const base = references(darkScheme.base, 'c');

/** One semantic scale for relevance, status and deadlines across all modules. */
export const tones: Record<Tone, ToneSet> = references(darkScheme.tones, 't');

export const iconTones: Record<IconTone, { fg: string; bg: string }> = references(darkScheme.iconTones, 'i');

export const shadows = references(darkScheme.shadows, 's');

/** Side menu and global header colors. */
export const chrome = references(darkScheme.chrome, 'x');

/**
 * Named colors used by the screens. Kept with the previous keys so every module
 * follows the palette from one place.
 */
export const colors = {
  ...base,
  green: tones.success.fg,
  orange: tones.warning.solid,
  red: tones.danger.fg,
  status: {
    done: { bg: tones.success.bg, text: tones.success.fg },
    delayed: { bg: tones.danger.bg, text: tones.danger.fg },
    ongoing: { bg: tones.info.bg, text: tones.info.fg },
    todo: { bg: tones.neutral.bg, text: tones.neutral.fg },
  },
  kanban: {
    done: { bg: tones.success.bg, border: tones.success.border },
    doing: { bg: tones.warning.bg, border: tones.warning.border },
    todo: { bg: base.bgMuted, border: base.borderStrong },
  },
} as const;

/** Spacing scale in multiples of 4px. */
export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40 } as const;

export const radius = { badge: 6, field: 8, card: 12, pill: 999 } as const;

/** Type scale (px): page title, section, card title, body, support text, label. */
export const fontSize = { page: 24, section: 18, cardTitle: 15, body: 14, support: 13, label: 11, stat: 26 } as const;

export const FONT_FAMILY = "'Geist Variable', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

/** Height of the global header, the same on every route. */
export const GLOBAL_HEADER_HEIGHT = 64;

/** Width limit of the main area. */
export const CONTENT_MAX_WIDTH = 1440;

// ── Ant Design ──────────────────────────────────────────────────────────────────────────────
// o antd calcula cores derivadas (hover, foco): recebe os valores reais de cada esquema

function buildAntdTheme(scheme: Scheme, dark: boolean): ThemeConfig {
  const { base: c, tones: t, shadows: s, chrome: x } = scheme;
  return {
    algorithm: dark ? antdAlgorithms.darkAlgorithm : antdAlgorithms.defaultAlgorithm,
    token: {
      colorPrimary: c.blue,
      colorInfo: c.blue,
      colorSuccess: t.success.solid,
      colorWarning: t.warning.solid,
      colorError: t.danger.solid,
      colorLink: dark ? '#6EA5FA' : c.blue,
      colorText: c.textDark,
      colorTextSecondary: c.textMuted,
      colorTextTertiary: c.textSubtle,
      colorTextQuaternary: c.textSubtle,
      colorBorder: c.borderStrong,
      colorBorderSecondary: c.border,
      colorSplit: c.border,
      colorBgLayout: c.bgApp,
      colorBgContainer: c.bgCard,
      colorBgElevated: c.bgElevated,
      colorFillTertiary: dark ? 'rgba(255, 255, 255, 0.06)' : palette.gray100,
      colorFillQuaternary: dark ? 'rgba(255, 255, 255, 0.03)' : palette.gray25,
      fontFamily: FONT_FAMILY,
      fontSize: fontSize.body,
      fontSizeSM: 12,
      fontSizeHeading1: 28,
      fontSizeHeading2: fontSize.page,
      fontSizeHeading3: fontSize.section,
      fontSizeHeading4: 16,
      fontSizeHeading5: fontSize.cardTitle,
      fontWeightStrong: 500,
      borderRadius: radius.field,
      borderRadiusSM: radius.badge,
      borderRadiusLG: radius.card,
      controlHeight: 34,
      controlHeightSM: 26,
      controlHeightLG: 40,
      boxShadow: s.md,
      boxShadowSecondary: s.md,
      boxShadowTertiary: s.sm,
      wireframe: false,
    },
    components: {
      Layout: {
        siderBg: x.siderBg,
        triggerBg: x.siderBg,
        bodyBg: c.bgApp,
        headerBg: x.siderBg,
      },
      Menu: {
        darkItemBg: 'transparent',
        darkSubMenuItemBg: 'transparent',
        darkPopupBg: c.bgElevated,
        darkItemSelectedBg: palette.blue600,
        darkItemColor: x.siderText,
        darkItemHoverBg: x.siderHover,
        itemBorderRadius: radius.field,
        itemHeight: 38,
        iconSize: 16,
        collapsedIconSize: 17,
      },
      Button: {
        fontWeight: 500,
        primaryShadow: 'none',
        defaultShadow: 'none',
        dangerShadow: 'none',
        defaultBorderColor: c.borderStrong,
        defaultBg: dark ? c.bgSubtle : c.bgCard,
      },
      Card: {
        borderRadiusLG: radius.card,
        headerFontSize: fontSize.cardTitle,
        headerHeight: 52,
        paddingLG: 16,
      },
      Input: {
        activeShadow: dark ? '0 0 0 3px rgba(59, 130, 246, 0.25)' : '0 0 0 3px rgba(26, 95, 208, 0.15)',
      },
      Select: {
        optionSelectedBg: c.blueSelected,
      },
      Tabs: {
        itemColor: c.textMuted,
        itemSelectedColor: c.navy,
        itemHoverColor: c.navy,
        inkBarColor: c.blue,
        titleFontSize: 13.5,
        horizontalItemGutter: 24,
        horizontalItemPadding: '8px 0 12px',
        horizontalMargin: '0 0 20px 0',
      },
      Table: {
        headerBg: c.bgSubtle,
        headerColor: c.textSubtle,
        headerSplitColor: 'transparent',
        rowHoverBg: dark ? 'rgba(255, 255, 255, 0.03)' : palette.gray25,
        borderColor: c.border,
        cellPaddingBlock: 10,
        cellPaddingInline: 12,
        cellFontSize: 13,
      },
      Tag: {
        defaultBg: c.bgMuted,
        defaultColor: c.textMuted,
      },
      Modal: {
        titleFontSize: 15,
        // título do modal fica no peso de título (o "strong" geral é 500)
        fontWeightStrong: 600,
        contentBg: c.bgElevated,
        headerBg: c.bgElevated,
        footerBg: c.bgElevated,
      },
      Segmented: {
        itemSelectedBg: dark ? '#26344B' : palette.white,
        trackBg: dark ? '#0F1622' : palette.gray100,
        itemColor: c.textMuted,
        itemSelectedColor: c.textDark,
      },
      Progress: {
        remainingColor: c.bgMuted,
        defaultColor: c.blue,
      },
      Statistic: {
        contentFontSize: fontSize.stat,
      },
      Drawer: {
        colorBgMask: dark ? 'rgba(0, 0, 0, 0.6)' : 'rgba(11, 42, 74, 0.45)',
      },
      Alert: {
        withDescriptionPadding: '12px 16px',
      },
      Calendar: {
        fullBg: c.bgCard,
        fullPanelBg: c.bgCard,
      },
    },
  };
}

/** Theme of the app in the dark appearance (the default). */
export const antdTheme: ThemeConfig = buildAntdTheme(darkScheme, true);

/** Light theme: the "Claro" appearance, and paper (the A4 project report) in any appearance. */
export const antdLightTheme: ThemeConfig = buildAntdTheme(lightScheme, false);
export const antdPaperTheme = antdLightTheme;
