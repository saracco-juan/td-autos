import { Link, NavLink, useLocation } from 'react-router'
import { DashboardNavIcon } from '../../../components/NavigationIcons/NavigationIcons'
import { isAdminDealerSection } from '../model/navigation'

export default function AdminNavigation({ className }: Readonly<{ className: string }>) {
  const { pathname } = useLocation()
  return <>
    <Link to="/admin/concesionarias" className={className}
      aria-current={isAdminDealerSection(pathname) ? 'page' : undefined}>
      <DashboardNavIcon name="dealers" />Concesionarias
    </Link>
    <NavLink to="/admin" end className={className}>
      <DashboardNavIcon name="metrics" />Administración
    </NavLink>
  </>
}
