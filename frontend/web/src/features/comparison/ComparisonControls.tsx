import { useNavigate } from 'react-router'
import { canCompare } from '@shared/comparison/selection'
import buttonStyles from '../../components/button.module.css'
import alertStyles from '../../components/alert.module.css'
import type { useComparisonSelection } from './useComparisonSelection'
import styles from './ComparisonPage.module.css'

export default function ComparisonControls({ selection }: { selection: ReturnType<typeof useComparisonSelection> }) {
  const navigate = useNavigate()
  const { ids, search, toggle, notice, setNotice } = selection
  return <section aria-label="Selección para comparar">
    <div className={styles.controls}>
      <span aria-live="polite">{ids.length}/2 seleccionados</span>
      {ids.map((id) => <button type="button" className={buttonStyles.button} key={id}
        onClick={() => toggle(id)} aria-label={`Quitar vehículo ${id}`}>QUITAR #{id}</button>)}
      <button type="button" className={`${buttonStyles.button} ${buttonStyles.primary}`} onClick={() => {
        if (canCompare(ids)) navigate(`/comparar?${search}`)
        else setNotice('Seleccioná exactamente dos vehículos para comparar.')
      }}>COMPARAR</button>
    </div>
    {notice ? <p role="alert" className={alertStyles.warning}>{notice}</p> : null}
  </section>
}
