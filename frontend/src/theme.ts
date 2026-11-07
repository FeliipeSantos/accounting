import type { ThemeConfig } from 'antd';

/**
 * Design tokens of the system. Every screen takes colors, type, spacing, radii and
 * shadows from here; Ant Design receives the same values through `antdTheme`.
 */

/** Brand and neutral palette (navy and institutional blue identity). */
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

/** One semantic scale for relevance, status and deadlines across all modules. */
export const tones: Record<Tone, { fg: string; bg: string; border: string; solid: string }> = {
  danger: { fg: '#C2362B', bg: '#FDECEA', border: '#F4C7C2', solid: '#C2362B' },
  warning: { fg: '#A35F00', bg: '#FFF3DF', border: '#F5D9A8', solid: '#D98A0B' },
  info: { fg: palette.blue600, bg: palette.blue50, border: palette.blue100, solid: palette.blue600 },
  success: { fg: '#1E7F4F', bg: '#E6F4EC', border: '#BFE3CE', solid: '#1E7F4F' },
  neutral: { fg: palette.gray600, bg: palette.gray100, border: palette.gray200, solid: '#C3CDD9' },
};

/**
 * Named colors used by the screens. Kept with the previous keys so every module
 * follows the new palette from one place.
 */
export const colors = {
  bgApp: palette.gray50,
  bgCard: palette.white,
  bgSubtle: palette.gray25,
  bgMuted: palette.gray100,
  navy: palette.navy900,
  navyDark: palette.navy700,
  blue: palette.blue600,
  blueHover: palette.blue700,
  blueSelected: palette.blue50,
  green: tones.success.fg,
  orange: tones.warning.solid,
  red: tones.danger.fg,
  textDark: palette.gray900,
  textMuted: palette.gray600,
  textSubtle: palette.gray500,
  border: palette.gray200,
  borderStrong: palette.gray300,
  status: {
    done: { bg: tones.success.bg, text: tones.success.fg },
    delayed: { bg: tones.danger.bg, text: tones.danger.fg },
    ongoing: { bg: tones.info.bg, text: tones.info.fg },
    todo: { bg: tones.neutral.bg, text: tones.neutral.fg },
  },
  kanban: {
    done: { bg: tones.success.bg, border: tones.success.border },
    doing: { bg: tones.warning.bg, border: tones.warning.border },
    todo: { bg: palette.gray100, border: palette.gray300 },
  },
} as const;

/** Soft colored circles behind the icons of indicators and list items. */
export type IconTone = 'blue' | 'green' | 'orange' | 'purple' | 'red' | 'gray';

export const iconTones: Record<IconTone, { fg: string; bg: string }> = {
  blue: { fg: palette.blue600, bg: '#E7F0FE' },
  green: { fg: '#16A34A', bg: '#E5F6EC' },
  orange: { fg: '#EA8A0C', bg: '#FFF1DE' },
  purple: { fg: '#7C4DDB', bg: '#EFE8FC' },
  red: { fg: '#D64545', bg: '#FDECEC' },
  gray: { fg: palette.gray600, bg: palette.gray100 },
};

/** Spacing scale in multiples of 4px. */
export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40 } as const;

export const radius = { badge: 6, field: 8, card: 12, pill: 999 } as const;

export const shadows = {
  sm: '0 1px 3px rgba(15, 30, 51, 0.05), 0 4px 12px -6px rgba(15, 30, 51, 0.08)',
  md: '0 4px 12px -2px rgba(15, 30, 51, 0.10), 0 2px 4px -2px rgba(15, 30, 51, 0.06)',
  lg: '0 12px 28px -8px rgba(15, 30, 51, 0.18), 0 4px 8px -4px rgba(15, 30, 51, 0.08)',
} as const;

/** Type scale (px): page title, section, card title, body, support text, label. */
export const fontSize = { page: 24, section: 18, cardTitle: 15, body: 14, support: 13, label: 11, stat: 26 } as const;

export const FONT_FAMILY = "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

/** Height of the global header, the same on every route. */
export const GLOBAL_HEADER_HEIGHT = 64;

/** Width limit of the main area. */
export const CONTENT_MAX_WIDTH = 1440;

export const antdTheme: ThemeConfig = {
  token: {
    colorPrimary: palette.blue600,
    colorInfo: palette.blue600,
    colorSuccess: tones.success.fg,
    colorWarning: tones.warning.solid,
    colorError: tones.danger.fg,
    colorLink: palette.blue600,
    colorText: palette.gray900,
    colorTextSecondary: palette.gray600,
    colorTextTertiary: palette.gray500,
    colorTextQuaternary: palette.gray500,
    colorBorder: palette.gray300,
    colorBorderSecondary: palette.gray200,
    colorSplit: palette.gray200,
    colorBgLayout: palette.gray50,
    colorBgContainer: palette.white,
    colorFillTertiary: palette.gray100,
    colorFillQuaternary: palette.gray25,
    fontFamily: FONT_FAMILY,
    fontSize: fontSize.body,
    fontSizeSM: 12,
    fontSizeHeading1: 28,
    fontSizeHeading2: fontSize.page,
    fontSizeHeading3: fontSize.section,
    fontSizeHeading4: 16,
    fontSizeHeading5: fontSize.cardTitle,
    fontWeightStrong: 600,
    borderRadius: radius.field,
    borderRadiusSM: radius.badge,
    borderRadiusLG: radius.card,
    controlHeight: 34,
    controlHeightSM: 26,
    controlHeightLG: 40,
    boxShadow: shadows.md,
    boxShadowSecondary: shadows.md,
    boxShadowTertiary: shadows.sm,
    wireframe: false,
  },
  components: {
    Layout: {
      siderBg: palette.navy900,
      triggerBg: palette.navy900,
      bodyBg: palette.gray50,
      headerBg: palette.navy900,
    },
    Menu: {
      darkItemBg: palette.navy900,
      darkSubMenuItemBg: palette.navy900,
      darkItemSelectedBg: palette.blue600,
      darkItemColor: '#C9D5E3',
      darkItemHoverBg: 'rgba(255, 255, 255, 0.06)',
      itemBorderRadius: radius.field,
      itemHeight: 38,
      iconSize: 16,
      collapsedIconSize: 17,
    },
    Button: {
      fontWeight: 600,
      primaryShadow: 'none',
      defaultShadow: 'none',
      dangerShadow: 'none',
      defaultBorderColor: palette.gray300,
    },
    Card: {
      borderRadiusLG: radius.card,
      headerFontSize: fontSize.cardTitle,
      headerHeight: 52,
      paddingLG: 16,
    },
    Input: {
      activeShadow: `0 0 0 3px rgba(26, 95, 208, 0.15)`,
    },
    Select: {
      optionSelectedBg: palette.blue50,
    },
    Tabs: {
      itemColor: palette.gray600,
      itemSelectedColor: palette.navy900,
      itemHoverColor: palette.navy900,
      inkBarColor: palette.blue600,
      titleFontSize: 13.5,
      horizontalItemGutter: 24,
      horizontalItemPadding: '8px 0 12px',
      horizontalMargin: '0 0 20px 0',
    },
    Table: {
      headerBg: palette.gray25,
      headerColor: palette.gray500,
      headerSplitColor: 'transparent',
      rowHoverBg: palette.gray25,
      borderColor: palette.gray200,
      cellPaddingBlock: 10,
      cellPaddingInline: 12,
      cellFontSize: 13,
    },
    Tag: {
      defaultBg: palette.gray100,
      defaultColor: palette.gray600,
    },
    Modal: {
      titleFontSize: 15,
    },
    Segmented: {
      itemSelectedBg: palette.white,
      trackBg: palette.gray100,
      itemColor: palette.gray600,
      itemSelectedColor: palette.gray900,
    },
    Progress: {
      remainingColor: palette.gray100,
      defaultColor: palette.blue600,
    },
    Statistic: {
      contentFontSize: fontSize.stat,
    },
    Drawer: {
      colorBgMask: 'rgba(11, 42, 74, 0.45)',
    },
    Alert: {
      withDescriptionPadding: '12px 16px',
    },
  },
};
