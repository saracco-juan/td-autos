import { createContext, useContext, useReducer, type ReactNode } from 'react'

import { toggleSelection } from '@shared/comparison/selection'

type Selection = { ids: number[]; notice: string | null }
const Context = createContext<(Selection & { toggle: (id: number) => void }) | null>(null)

function reduce(state: Selection, id: number): Selection {
  const next = toggleSelection(state.ids, id)
  return { ids: next.ids, notice: next.rejected ? 'La comparación admite exactamente dos vehículos.' : null }
}

// Only IDs survive navigation between buyer tabs. Logout unmounts the provider; facts are always fetched again.
export function ComparisonSelectionProvider({ children }: { children: ReactNode }) {
  const [selection, toggle] = useReducer(reduce, { ids: [], notice: null })
  return <Context.Provider value={{ ...selection, toggle }}>{children}</Context.Provider>
}

export function useComparisonSelection() {
  const selection = useContext(Context)
  if (!selection) throw new Error('Comparison selection requires the buyer navigation provider')
  return selection
}
