import { useState, type CSSProperties } from 'react'
import { Link, useLocation } from 'react-router'
import { vehicleTitle } from '@shared/checklist/inspection/vehicle'
import type { SpecificationRow } from '@shared/vehicles/detail'
import { comparisonGroups, type ComparisonEntry } from '@shared/comparison/groups'
import InfoTip from '../../components/InfoTip'
import Tabs from '../../components/Tabs/Tabs'
import buttonStyles from '../../components/Buttons/button.module.css'
import styles from './ComparisonTable.module.css'

export type { ComparisonEntry } from '@shared/comparison/groups'

function Photo({ url, title }: { url: string | undefined; title: string }) {
  const [failed, setFailed] = useState(false)
  return url && !failed ? <img className={styles.photo} src={url} alt={`Foto de ${title}`}
    onError={() => setFailed(true)} /> : <div className={styles.photo} role="img" aria-label={`Foto de ${title}`}>
      Fotos no disponibles.
    </div>
}

function Facts({ rows, title, hiddenLabels, className }: {
  rows: SpecificationRow[]; title: string; hiddenLabels?: Set<string>; className?: string
}) {
  return <dl className={`${styles.facts} ${className ?? ''}`}>
    {rows.map(({ label, value, explanation }) => <div className={styles.factSlot} key={label}
      data-hidden={hiddenLabels?.has(label) || undefined} aria-hidden={hiddenLabels?.has(label) || undefined}
      inert={hiddenLabels?.has(label) || undefined}>
      <div className={styles.factClip}><div className={styles.fact}>
      <dt>{label}{explanation ? <> <InfoTip label={`Sobre ${label} de ${title}`}>{explanation}</InfoTip></> : null}</dt>
      <dd>{value}</dd>
      </div></div>
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
  const [hideSimilarities, setHideSimilarities] = useState(false)
  const selected = columns.map(({ groups }) => {
    const group = groups.find(({ title }) => title === section) ?? groups[1]
    return section === 'Información general' ? [...groups[0].rows, ...group.rows] : group.rows
  })
  const matchingLabels = new Set(selected[0].filter(({ label, value }) => value !== 'No disponible'
    && selected[1].some((row) => row.label === label && row.value === value)).map(({ label }) => label))
  const visibleRows = selected.map((rows) => hideSimilarities ? rows.filter(({ label }) => !matchingLabels.has(label)) : rows)
  const items = columns[0].groups.slice(1).map(({ title }) => ({ id: title, label: title }))
  const specificationRows = Math.max(...selected.map((rows) => rows.length))
  const allSimilar = visibleRows.every((rows) => rows.length === 0)
  const specificationStyle = { '--specification-rows': specificationRows + 1 } as CSSProperties

  return <>
    <details className={styles.notes}>
      <summary>Sobre la comparación y los costos</summary>
      <p>Los motivos reflejan tu diagnóstico, no una probabilidad de satisfacción. No indican un ganador absoluto.</p>
      <p>Costos orientativos de la calculadora, con sus valores predeterminados. Los totales parciales excluyen los conceptos indicados.</p>
    </details>
    <div className={styles.viewport} tabIndex={0} role="region" aria-label="Comparación de vehículos">
      <div className={styles.cards}>
        {columns.map(({ id, detail, title }) => <article key={id} className={styles.card} aria-labelledby={`comparison-${id}`}>
          <Photo url={detail.vehicle.fotos[0]?.url} title={title} />
          <div className={styles.intro}>
            <h2 id={`comparison-${id}`}>{title}</h2>
            <button type="button" className={`${buttonStyles.button} ${styles.remove}`}
              aria-label={`Quitar ${title}`} onClick={() => onRemove(id)}>QUITAR</button>
          </div>
        </article>)}
      </div>
      <section className={styles.specifications} aria-label="Especificaciones técnicas">
        <div className={styles.sectionHeading}>
          <h2>Especificaciones técnicas</h2>
          <label className={styles.hideSimilarities}>
            <input type="checkbox" checked={hideSimilarities} onChange={(event) => setHideSimilarities(event.target.checked)} />
            Ocultar similitudes
          </label>
        </div>
        <Tabs label="Secciones de la comparación" items={items} value={section} onValueChange={setSection}
          className={styles.sectionTabs} panelClassName={styles.sectionPanel} variant="underline">
          {() => <>
            <div className={styles.specificationColumns} style={specificationStyle}>
            {columns.map(({ id, title }, index) => <div key={id} className={styles.specificationColumn} role="group"
              aria-label={`Especificaciones de ${title}`}
              style={{ '--fact-count': selected[index].length } as CSSProperties}>
              <h3>{title}</h3>
              <Facts rows={selected[index]} title={title} hiddenLabels={hideSimilarities ? matchingLabels : undefined}
                className={styles.specificationFacts} />
            </div>)}
          </div>
          <div className={styles.factSlot} data-hidden={!allSimilar || undefined} aria-hidden={!allSimilar || undefined}>
            <div className={styles.factClip}><p className={styles.empty} role={allSimilar ? 'status' : undefined}>
              Todos los datos disponibles de esta sección coinciden.
            </p></div>
          </div>
          </>}
        </Tabs>
        {section === 'Costos estimados en ARS' ? <div className={styles.costLinks}>
          {columns.map(({ id, title }) => <Link key={id} className={buttonStyles.button} to={`/vehiculos/${id}/costos`}
            state={{ comparisonReturnTo }} aria-label={`Ver cálculo completo de ${title}`}>VER CÁLCULO COMPLETO</Link>)}
        </div> : null}
      </section>
    </div>
  </>
}
