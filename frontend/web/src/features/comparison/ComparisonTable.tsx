import { useState, type CSSProperties } from 'react'
import { Link, useLocation } from 'react-router'
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
    onError={() => setFailed(true)} /> : <div className={styles.photo} role="img" aria-label={`Foto de ${title}`}>
      Fotos no disponibles.
    </div>
}

function Facts({ rows, title, className }: { rows: SpecificationRow[]; title: string; className?: string }) {
  return <dl className={`${styles.facts} ${className ?? ''}`}>
    {rows.map(({ label, value, explanation }) => <div className={styles.fact} key={label}>
      <dt>{label}{explanation ? <> <InfoTip label={`Sobre ${label} de ${title}`}>{explanation}</InfoTip></> : null}</dt>
      <dd>{value}</dd>
    </div>)}
  </dl>
}

export default function ComparisonTable({ entries, onRemove }: {
  entries: [ComparisonEntry, ComparisonEntry]; onRemove: (id: number) => void
}) {
  const location = useLocation()
  const comparisonReturnTo = location.pathname + location.search
  const columns = entries.map((entry) => ({ ...entry, title: vehicleTitle(entry.detail.vehicle), groups: comparisonGroups(entry) }))
  const [section, setSection] = useState('Información general')
  const selected = columns.map(({ groups }) => groups.find(({ title }) => title === section) ?? groups[1])
  const items = columns[0].groups.slice(1).map(({ title }) => ({ id: title, label: title }))
  const summaryRows = Math.max(...columns.map(({ groups }) => groups[0].rows.length))
  const specificationRows = Math.max(...selected.map(({ rows }) => rows.length))
  const summaryStyle = { '--summary-rows': summaryRows + 3 } as CSSProperties
  const specificationStyle = { '--specification-rows': specificationRows + 1 } as CSSProperties

  return <>
    <details className={styles.notes}>
      <summary>Sobre la comparación y los costos</summary>
      <p>Los motivos reflejan tu diagnóstico, no una probabilidad de satisfacción. No indican un ganador absoluto.</p>
      <p>Costos orientativos de la calculadora, con sus valores predeterminados. Los totales parciales excluyen los conceptos indicados.</p>
    </details>
    <div className={styles.viewport} tabIndex={0} role="region" aria-label="Comparación de vehículos">
      <div className={styles.cards} style={summaryStyle}>
        {columns.map(({ id, detail, title, groups }) => <article key={id} className={styles.card} aria-labelledby={`comparison-${id}`}
          style={{ '--fact-count': groups[0].rows.length, '--footer-row': summaryRows + 3 } as CSSProperties}>
          <Photo url={detail.vehicle.fotos[0]?.url} title={title} />
          <div className={styles.intro}>
            <h2 id={`comparison-${id}`}>{title}</h2>
            <button type="button" className={`${buttonStyles.button} ${styles.remove}`}
              aria-label={`Quitar ${title}`} onClick={() => onRemove(id)}>QUITAR</button>
          </div>
          <Facts rows={groups[0].rows} title={title} className={styles.summaryFacts} />
          <div className={styles.footer}>
            <Link className={buttonStyles.button} to={`/vehiculos/${id}/costos`}
              state={{ comparisonReturnTo }}>VER CÁLCULO COMPLETO</Link>
          </div>
        </article>)}
      </div>
      <section className={styles.specifications} aria-label="Especificaciones técnicas">
        <h2>Especificaciones técnicas</h2>
        <Tabs label="Secciones de la comparación" items={items} value={section} onValueChange={setSection}
          className={styles.sectionTabs} panelClassName={styles.sectionPanel} variant="underline">
          {() => <div className={styles.specificationColumns} style={specificationStyle}>
            {columns.map(({ id, title }, index) => <div key={id} className={styles.specificationColumn} role="group"
              aria-label={`Especificaciones de ${title}`}
              style={{ '--fact-count': selected[index].rows.length } as CSSProperties}>
              <h3>{title}</h3>
              <Facts rows={selected[index].rows} title={title} className={styles.specificationFacts} />
            </div>)}
          </div>}
        </Tabs>
      </section>
    </div>
  </>
}
