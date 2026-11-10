// Design tokens, mirrored from the Figma variables and the web `index.css`.
export const colors = {
  red: '#e02404',
  charcoal: '#241f1c',
  background: '#faf8f6',
  surface: '#ffffff',
  surfaceRaised: '#f1ebe7',
  textPrimary: '#111111',
  textSecondary: '#666666',
  onColor: '#ffffff',
  actionDanger: '#da291c',
  actionSuccess: '#17803a',
  borderDefault: '#e4dcd7',
  borderInput: '#c8c8c8',
  success: '#1e7f45',
  errorBg: '#fde8e4',
  errorBorder: '#f3b5aa',
  successBg: '#e3f4ea',
  successBorder: '#a9d8bc',
  warningBg: '#fdf1d6',
  warningBorder: '#efd28f',
} as const

export const radii = { field: 8, button: 10, card: 14 } as const

export const shadows = {
  soft: {
    shadowColor: '#1a140f',
    shadowOpacity: 0.06,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  card: {
    shadowColor: '#1a140f',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
} as const
