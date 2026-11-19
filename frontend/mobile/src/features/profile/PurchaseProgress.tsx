import { useCallback, useState } from 'react'
import { useFocusEffect, useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { summarizeChecklist } from '@shared/checklist/progress'
import { toChecklistSteps as inspectionSteps } from '@shared/checklist/inspection/steps'
import { toChecklistSteps as transferSteps } from '@shared/checklist/transfer/steps'
import { vehicleTitle } from '@shared/checklist/inspection/vehicle'
import type { InspectionIndex } from '@shared/checklist/inspection/types'
import type { TransferResponse } from '@shared/checklist/transfer/types'
import ChecklistProgress from '../../components/checklist/ChecklistProgress'
import { archivo } from '../../theme/archivo'
import { colors } from '../../theme/tokens'
import { useAuth } from '../auth/useAuth'
import { fetchTransfer } from '../transfer/api'

type Results = { inspections: PromiseSettledResult<InspectionIndex>; transfer: PromiseSettledResult<TransferResponse> }

export default function PurchaseProgress() {
  const { authFetch } = useAuth()
  const router = useRouter()
  const [results, setResults] = useState<Results>()
  const [attempt, setAttempt] = useState(0)
  useFocusEffect(useCallback(() => {
    let active = true
    if (attempt > 0) setResults(undefined)
    void Promise.allSettled([
      Promise.resolve().then(() => authFetch<InspectionIndex>('/api/inspecciones')),
      Promise.resolve().then(() => fetchTransfer(authFetch)),
    ]).then(([inspections, transfer]) => { if (active) setResults({ inspections, transfer }) })
    return () => { active = false }
  }, [authFetch, attempt]))
  const inspections = results?.inspections.status === 'fulfilled' ? results.inspections.value : undefined
  const transfer = results?.transfer.status === 'fulfilled' ? results.transfer.value : undefined
  const failed = results?.inspections.status === 'rejected' || results?.transfer.status === 'rejected'
  const summary = transfer && summarizeChecklist(transferSteps(transfer.etapas), transfer.items_completados)
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={[styles.heading, archivo(true)]}>Retomá tu compra</Text>
      <Text style={styles.caption}>Seguí tus checklists donde los dejaste.</Text>
      {!results && <Text accessibilityLiveRegion="polite">Cargando tu avance…</Text>}
      {results?.inspections.status === 'rejected' && <Text accessibilityRole="alert">No pudimos cargar tus inspecciones.</Text>}
      {inspections?.inspecciones.length === 0 && <Text style={styles.caption}>Cuando empieces una inspección desde la ficha de un auto, vas a poder retomarla desde acá.</Text>}
      {inspections?.inspecciones.map(item => {
        const progress = summarizeChecklist(inspectionSteps(inspections.pasos), item.items_completados)
        return <ResumeRow key={item.vehiculo.id} title={vehicleTitle({ ...item.vehiculo, version: null })}
          subtitle={item.vehiculo.version} kind="Inspección" completed={progress.completed} total={progress.total}
          action={progress.complete ? 'Ver inspección' : 'Continuar inspección'}
          onPress={() => router.push(`/vehiculos/${item.vehiculo.id}/inspeccion`)} />
      })}
      {results?.transfer.status === 'rejected' && <Text accessibilityRole="alert">No pudimos cargar tu transferencia.</Text>}
      {summary && <ResumeRow title="Transferencia" completed={summary.completed} total={summary.total}
        action={summary.complete ? 'Ver transferencia' : transfer?.estado ? 'Continuar transferencia' : 'Empezar transferencia'}
        onPress={() => router.navigate('/transferencia')} />}
      {failed && <Pressable accessibilityRole="button" onPress={() => setAttempt(value => value + 1)} style={styles.action}>
        <Text>Reintentar</Text>
      </Pressable>}
    </View>
  )
}

function ResumeRow({ title, subtitle, kind, completed, total, action, onPress }: Readonly<{
  title: string; subtitle?: string | null; kind?: string; completed: number; total: number; action: string; onPress: () => void
}>) {
  return (
    <View style={styles.row}>
      {kind && <Text style={styles.caption}>{kind}</Text>}
      <Text style={[styles.title, archivo(true)]}>{title}</Text>
      {subtitle && <Text style={styles.caption}>{subtitle}</Text>}
      <ChecklistProgress completed={completed} total={total} label={`${completed} de ${total} ítems marcados`} />
      <Pressable accessibilityRole="link" accessibilityLabel={`${action}, ${title}`} onPress={onPress} style={styles.action}>
        <Text style={archivo(true)}>{action}</Text><Text aria-hidden>→</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  heading: { fontSize: 21, color: colors.textPrimary },
  caption: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  row: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.borderDefault, paddingTop: 16, gap: 5 },
  title: { fontSize: 16, color: colors.textPrimary },
  action: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-end' },
})
