import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { readSelection, toggleSelection } from '@shared/comparison/selection'

export function useComparisonSelection() {
  const [search, setSearch] = useSearchParams()
  const [notice, setNotice] = useState('')
  const ids = readSelection(search.get('compare'))
  function toggle(id: number) {
    const next = toggleSelection(ids, id)
    setNotice(next.rejected ? 'La comparación admite exactamente dos vehículos. Quitá uno para elegir otro.' : '')
    if (next.rejected) return
    const params = new URLSearchParams(search)
    if (next.ids.length) params.set('compare', next.ids.join(','))
    else params.delete('compare')
    setSearch(params, { replace: true })
  }
  return { ids, search, toggle, notice, setNotice }
}
