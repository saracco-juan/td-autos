import { useEffect, useState } from 'react'

import ChecklistLayout, { type ChecklistCopy } from '../../components/checklist/ChecklistLayout'
import SummaryLayout from '../../components/checklist/SummaryLayout'
import { useChecklistFlow } from '../../components/checklist/useChecklistFlow'
import Button from '../../components/Button'
import Loader from '../../components/Loader'
import { HttpError, NetworkError } from '../../lib/http'
import { useAuth } from '../auth/useAuth'
import LoadError, { type LoadErrorKind } from '../diagnosis/LoadError'
import { firstPendingStep } from '@shared/checklist/progress'
import {
  ACTION_LABELS,
  FLAG_LABEL,
  SAVE_ERROR,
  SUMMARY_LABELS,
  criticalWarning,
  pendingMarkerLabel,
} from '@shared/checklist/inspection/copy'
import { toChecklistSteps } from '@shared/checklist/inspection/steps'
import type { InspectionStep, InspectionVehicle } from '@shared/checklist/inspection/types'
import { parseVehicleId, vehicleTitle } from '@shared/checklist/inspection/vehicle'
import { fetchInspection, finishInspection, setItemCompleted } from './api'
import InspectionHeader, { useBackToSheet } from './InspectionHeader'
import InspectionSummary from './InspectionSummary'
import VehicleNotFound from './VehicleNotFound'

type LoadState = 'loading' | 'ready' | 'not-found' | { error: LoadErrorKind }
type Content = { vehicle: InspectionVehicle; steps: InspectionStep[] }

const COPY: ChecklistCopy = {
  actionLabels: ACTION_LABELS,
  flagLabel: FLAG_LABEL,
  saveError: SAVE_ERROR,
  pendingMarkerLabel,
}

// Inspection checklist (UH-12, RF11, CU of the inspection): same behavior as the web page, mobile layout.
export default function InspectionScreen({ rawId }: Readonly<{ rawId: string | undefined }>) {
  const vehicleId = parseVehicleId(rawId)

  if (vehicleId === null) return <VehicleNotFound />

  // The key restarts the whole screen when the route points to another vehicle.
  return <Checklist key={vehicleId} vehicleId={vehicleId} />
}

function Checklist({ vehicleId }: Readonly<{ vehicleId: number }>) {
  const { authFetch } = useAuth()
  const goBack = useBackToSheet()
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [content, setContent] = useState<Content | null>(null)
  const steps = toChecklistSteps(content?.steps ?? [])
  const flow = useChecklistFlow({
    steps,
    save: (code, value) => setItemCompleted(authFetch, vehicleId, code, value),
    finish: () => finishInspection(authFetch, vehicleId),
    warningFor: criticalWarning,
  })
  const { load, setSelected } = flow

  useEffect(() => {
    let cancelled = false
    fetchInspection(authFetch, vehicleId)
      .then((inspection) => {
        if (cancelled) return
        setContent({ vehicle: inspection.vehiculo, steps: inspection.pasos })
        load(inspection.items_completados)
        setSelected(firstPendingStep(toChecklistSteps(inspection.pasos), inspection.items_completados))
        setLoadState('ready')
      })
      .catch((error: unknown) => {
        if (cancelled) return
        if (error instanceof HttpError && error.status === 404) setLoadState('not-found')
        else setLoadState({ error: error instanceof NetworkError ? 'network' : 'server' })
      })
    return () => {
      cancelled = true
    }
  }, [authFetch, vehicleId, load, setSelected])

  if (loadState === 'loading') return <Loader />
  if (loadState === 'not-found') return <VehicleNotFound />
  if (typeof loadState === 'object') return <LoadError kind={loadState.error} />
  if (!content) return <Loader />

  const { progress } = flow
  const header = (
    <InspectionHeader title={vehicleTitle(content.vehicle)} completed={progress.completed} total={progress.total} />
  )

  if (flow.view === 'summary') {
    return (
      <SummaryLayout header={header} summary={<InspectionSummary progress={progress} />}>
        <Button label={SUMMARY_LABELS.backToSheet} onPress={goBack} />
        <Button label={SUMMARY_LABELS.keepReviewing} variant="primary" onPress={() => flow.setView('checklist')} />
      </SummaryLayout>
    )
  }

  return <ChecklistLayout flow={flow} steps={steps} copy={COPY} header={header} />
}
