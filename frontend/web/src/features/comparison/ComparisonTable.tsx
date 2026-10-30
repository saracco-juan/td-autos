import { useState, type CSSProperties } from 'react'
import { Link } from 'react-router'
import { vehicleTitle } from '@shared/checklist/inspection/vehicle'
import type { SpecificationRow } from '@shared/vehicles/detail'
import { comparisonGroups, type ComparisonEntry } from '@shared/comparison/groups'
import InfoTip from '../../components/InfoTip'
import Tabs from '../../components/Tabs'
import buttonStyles from '../../components/button.module.css'
import styles from './ComparisonTable.module.css'

export type { ComparisonEntry } from '@shared/comparison/groups'

function Photo({ url, title }: { url: string | undefined; title: string }) {
  const [failed, setFailed] = useState(false)
  return url && !failed ? <img className={styles.photo} src={url} alt={`Foto de ${title}`}
    onError={() => setFailed(true)} /> : <div className={styles.photo}>Fotos no disponibles.</div>
}

function Facts({ rows, title }: { rows: SpecificationRow[]; title: string }) {
  return <dl className={styles.facts} style={{ gridRow: `span ${rows.length}` }}>
    {rows.map(({ label, value, explanation }) => <div className={styles.fact} key={label}>
      <dt>{label}{explanation ? <> <InfoTip label={`Sobre ${label} de ${title}`}>{explanation}</InfoTip></> : null}</dt>
      <dd>{value}</dd>
    </div>)}
  </dl>
}

export default function ComparisonTable({ entries, onRemove }: {
  entries: [ComparisonEntry, ComparisonEntry]; onRemove: (id: number) => void
}) {
  const [section, setSection] = useState('Información general')
  const columns = entries.map(comparisonGroups)
  const selected = columns.map((column) => column.find(({ title }) => title === section) ?? column[1])
  const items = columns[0].slice(1).map(({ title }) => ({ id: title, label: title }))
  const rowCount = 5 + columns[0][0].rows.length + selected[0].rows.length
  return (
    <>
      <details className={styles.notes}>
        <summary>Sobre la comparación y los costos</summary>
        <p>Los motivos reflejan tu diagnóstico, no una probabilidad de satisfacción. No indican un ganador absoluto.</p>
        <p>Costos orientativos de la calculadora, con sus valores predeterminados. Los totales parciales excluyen los conceptos indicados.</p>
      </details>
      <div className={styles.viewport} tabIndex={0} role="region" aria-label="Comparación de vehículos">
        <div className={styles.cards}>
          {entries.map(({ id, detail: { vehicle } }, columnIndex) => {
            const title = vehicleTitle(vehicle)
            const rows = selected[columnIndex].rows
            return <article key={id} className={styles.card} aria-labelledby={`comparison-${id}`}
              style={{ gridRow: `1 / span ${rowCount}`, '--section-rows': rows.length } as CSSProperties}>
              <Photo key={vehicle.fotos[0]?.url} url={vehicle.fotos[0]?.url} title={title} />
              <div className={styles.intro}>
                <h2 id={`comparison-${id}`}>{title}</h2>
                <button type="button" className={`${buttonStyles.button} ${styles.remove}`}
                  aria-label={`Quitar ${title}`} onClick={() => onRemove(id)}>QUITAR</button>
              </div>
              <Facts rows={columns[columnIndex][0].rows} title={title} />
              <section className={styles.specifications} aria-label={`Especificaciones de ${title}`}>
                <h3>Especificaciones técnicas</h3>
                <Tabs label={`Secciones de ${title}`} items={items} value={section} onValueChange={setSection}
                  className={styles.sectionTabs} panelClassName={styles.sectionPanel}>
                  {() => <Facts rows={rows} title={title} />}
                </Tabs>
              </section>
              <div className={styles.footer}>
                <Link className={buttonStyles.button} to={`/vehiculos/${id}/costos`}>VER CÁLCULO COMPLETO</Link>
              </div>
            </article>
          })}
        </div>
      </div>
    </>
  )
}
