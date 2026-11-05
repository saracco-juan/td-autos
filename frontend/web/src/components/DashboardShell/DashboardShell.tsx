import type { ReactNode } from 'react'
import BrandLink from '../BrandLink/BrandLink'
import { LogoutIcon, MenuIcon } from '../NavigationIcons/NavigationIcons'
import styles from './DashboardShell.module.css'

export type DashboardShellProps = Readonly<{
  account: Readonly<{ name: string; email: string; label: string }>
  navigationLabel: string
  renderNavigation: (className: string) => ReactNode
  menuOpen: boolean
  menuId: string
  onMenuToggle: () => void
  loggingOut: boolean
  onLogout: () => void
  children: ReactNode
}>

export default function DashboardShell({ account, navigationLabel, renderNavigation,
  menuOpen, menuId, onMenuToggle, loggingOut, onLogout, children }: DashboardShellProps) {
  return (
    <div className={styles.shell}>
      <header className={styles.sidebar}>
        <BrandLink className={styles.brand} />
        <button type="button" className={`${styles.action} ${styles.menuToggle}`}
          aria-expanded={menuOpen} aria-controls={menuId} onClick={onMenuToggle}>
          <MenuIcon open={menuOpen} />Menú
        </button>
        <div id={menuId} className={`${styles.panel} ${menuOpen ? styles.panelOpen : ''}`}>
          <nav aria-label={navigationLabel} className={styles.navigation}>
            {renderNavigation(styles.action)}
          </nav>
          <div role="group" aria-label={account.label} className={styles.account}>
            <div className={styles.identity}>
              <span className={styles.avatar} aria-hidden="true">{account.name.slice(0, 2).toLocaleUpperCase('es-AR')}</span>
              <div className={styles.details}><strong>{account.name}</strong><span>{account.email}</span></div>
            </div>
            <button type="button" className={styles.action} disabled={loggingOut} aria-busy={loggingOut} onClick={onLogout}>
              <LogoutIcon />Cerrar sesión
            </button>
          </div>
        </div>
      </header>
      <main className={styles.content}>{children}</main>
    </div>
  )
}
