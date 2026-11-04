import type { NavigateFunction } from 'react-router'

export const INVENTORY_PATH = '/concesionaria/inventario'

// What the list receives through the navigation state after a save.
export type InventoryLocationState = { notice?: string }

export function goToInventory(navigate: NavigateFunction, notice: string): void {
  navigate(INVENTORY_PATH, { state: { notice } satisfies InventoryLocationState })
}
