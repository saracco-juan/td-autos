import DashboardShell, { type DashboardShellProps } from '../../../components/DashboardShell/DashboardShell'
import type { User } from '../../auth/model/types'
import DealerNavigation from './DealerNavigation'

type Props = Omit<DashboardShellProps, 'account' | 'navigationLabel' | 'renderNavigation'> & Readonly<{ user: User }>

export default function DealerShell({ user, ...props }: Props) {
  return <DashboardShell {...props}
    account={{ name: user.concesionaria?.nombre || user.name, email: user.email, label: 'Cuenta de la concesionaria' }}
    navigationLabel="Concesionaria"
    renderNavigation={(className) => <DealerNavigation user={user} className={className} showIcons />} />
}
