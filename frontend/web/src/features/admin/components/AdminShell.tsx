import DashboardShell, { type DashboardShellProps } from '../../../components/DashboardShell/DashboardShell'
import type { User } from '../../auth/model/types'
import AdminNavigation from './AdminNavigation'

type Props = Omit<DashboardShellProps, 'account' | 'navigationLabel' | 'renderNavigation'> & Readonly<{ user: User }>

export default function AdminShell({ user, ...props }: Props) {
  return <DashboardShell {...props}
    account={{ name: user.name, email: user.email, label: 'Cuenta administrativa' }}
    navigationLabel="Administración"
    renderNavigation={(className) => <AdminNavigation className={className} />} />
}
