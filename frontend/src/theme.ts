import type { ThemeConfig } from 'antd';

/** Visual identity of the system (same palette as the previous screens). */
export const colors = {
  bgApp: '#f4f6f9',
  bgCard: '#ffffff',
  bgSubtle: '#f8fafc',
  bgMuted: '#f1f5f9',
  navy: '#0B2A4A',
  navyDark: '#1e293b',
  blue: '#1a73e8',
  blueHover: '#1557b0',
  blueSelected: '#e2eafc',
  green: '#2e7d32',
  orange: '#d97706',
  red: '#d32f2f',
  textDark: '#1e293b',
  textMuted: '#64748b',
  border: '#e2e8f0',
  borderStrong: '#cbd5e1',
  status: {
    done: { bg: '#e3fcef', text: '#00875a' },
    delayed: { bg: '#ffebe6', text: '#de350b' },
    ongoing: { bg: '#fffae6', text: '#b78103' },
    todo: { bg: '#f4f5f7', text: '#5e6c84' },
  },
  kanban: {
    done: { bg: '#e2f9ec', border: '#b2f0c9' },
    doing: { bg: '#fff6e0', border: '#ffe6a3' },
    todo: { bg: '#f1f5f9', border: '#cbd5e1' },
  },
} as const;

export const shadows = {
  sm: '0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.1)',
  md: '0 4px 6px -1px rgba(0,0,0,0.08), 0 2px 4px -1px rgba(0,0,0,0.04)',
  lg: '0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -2px rgba(0,0,0,0.04)',
} as const;

export const FONT_FAMILY = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

export const antdTheme: ThemeConfig = {
  token: {
    colorPrimary: colors.blue,
    colorSuccess: colors.green,
    colorWarning: colors.orange,
    colorError: colors.red,
    colorText: colors.textDark,
    colorTextSecondary: colors.textMuted,
    colorBorder: colors.border,
    colorBgLayout: colors.bgApp,
    fontFamily: FONT_FAMILY,
    borderRadius: 8,
    borderRadiusSM: 4,
    borderRadiusLG: 12,
  },
  components: {
    Layout: {
      siderBg: colors.navy,
      triggerBg: colors.navy,
      bodyBg: colors.bgApp,
      headerBg: colors.navy,
    },
    Menu: {
      darkItemBg: colors.navy,
      darkSubMenuItemBg: colors.navy,
      darkItemSelectedBg: colors.blue,
    },
    Card: {
      borderRadiusLG: 12,
    },
  },
};
