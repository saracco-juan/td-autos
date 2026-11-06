// Receipt review belongs to the dealership directory in administrator navigation.
export function isAdminDealerSection(pathname: string): boolean {
  return pathname.startsWith('/admin/concesionarias') || pathname.startsWith('/admin/comprobantes/')
}
