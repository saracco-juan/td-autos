export function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        d={open ? "M6 6l12 12M18 6L6 18" : "M4 7h16M4 12h16M4 17h16"}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">
      <path
        d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const dashboardPaths = {
  subscription: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1ZM3 9h18M6 15h4',
  verification: 'M12 3 4 6v5c0 5 8 10 8 10s8-5 8-10V6l-8-3ZM8 12l3 3 5-6',
  inventory: 'm5 9 2-5h10l2 5M5 9h14l2 3v6H3v-6l2-3ZM6 18v3M18 18v3M6 13h2M16 13h2',
  metrics: 'M4 3v17h17M8 15v-4M13 15V6M18 15V9',
}

export function DashboardNavIcon({ name }: Readonly<{ name: keyof typeof dashboardPaths }>) {
  return <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"
    fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d={dashboardPaths[name]} />
  </svg>
}
