import { NavLink } from 'react-router'
import { isActiveDealer } from '../../auth/model/roles'
import type { User } from '../../auth/model/types'
import { DashboardNavIcon } from '../../../components/NavigationIcons/NavigationIcons'

type Props = Readonly<{ user: User | null; className: string; showIcons?: boolean }>

export default function DealerNavigation({ user, className, showIcons = false }: Props) {
  return <>
    <NavLink to="/concesionaria/suscripcion" className={className}>
      {showIcons ? <DashboardNavIcon name="subscription" /> : null}Suscripción
    </NavLink>
    <NavLink to="/concesionaria" end className={className}>
      {showIcons ? <DashboardNavIcon name="verification" /> : null}Verificación
    </NavLink>
    {isActiveDealer(user) ? (
      <NavLink to="/concesionaria/inventario" className={className}>
        {showIcons ? <DashboardNavIcon name="inventory" /> : null}Inventario
      </NavLink>
    ) : null}
    <NavLink to="/concesionaria/leads" className={className}>
      {showIcons ? <DashboardNavIcon name="metrics" /> : null}Métricas
    </NavLink>
  </>
}
