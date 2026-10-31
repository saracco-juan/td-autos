import { useFocusEffect } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import Button from '../../components/Button'
import Loader from '../../components/Loader'
import { colors, radii, shadows } from '../../theme/tokens'
import { useAuth } from '../auth/useAuth'
import { PORTAL_EMPTY_COPY, portalSourceLabel } from '@shared/portals/format'
import type { PortalModelsResponse } from '@shared/portals/models'
import { emptyStateCopy, exchangeRateNotice } from '@shared/recommendations/format'
import Alert from '../../components/Alert'
import PortalModelCard from './PortalModelCard'
import { fetchPortalModels } from './portalModels'

type State = { status: 'loading' } | { status: 'error' } | { status: 'ready'; response: PortalModelsResponse }
type Props = { onCount: (count: number | null) => void; onDiagnosis: () => void }

export default function PortalModelsPanel({ onCount, onDiagnosis }: Readonly<Props>) {
  const { authFetch } = useAuth()
  const [state, setState] = useState<State>({ status: 'loading' })
  const request = useRef(0)
  const load = useCallback(() => {
    const id = ++request.current
    setState({ status: 'loading' })
    onCount(null)
    fetchPortalModels(authFetch).then((response) => {
      if (id !== request.current) return
      setState({ status: 'ready', response })
      onCount(response.status === 'ready' ? response.modelos.length : null)
    }).catch(() => {
      if (id === request.current) setState({ status: 'error' })
    })
  }, [authFetch, onCount])

  useFocusEffect(useCallback(() => {
    load()
    return () => { request.current += 1 }
  }, [load]))

  if (state.status === 'loading') return <View style={styles.section}><Loader /></View>
  if (state.status === 'error') return (
    <View style={styles.section}>
      <Alert variant="error">No pudimos cargar los modelos.</Alert>
      <Button label="REINTENTAR" onPress={load} />
    </View>
  )
  const { response } = state
  if (response.status === 'diagnosis_incomplete' || response.modelos.length === 0) {
    const copy = response.status === 'diagnosis_incomplete' ? emptyStateCopy('diagnosis_incomplete', false) : PORTAL_EMPTY_COPY
    return (
      <View style={styles.empty}>
        <Text accessibilityRole="header" style={styles.title}>{copy.title}</Text>
        <Text style={styles.meta}>{copy.hint}</Text>
        {response.status === 'diagnosis_incomplete' ? <Button label="IR AL DIAGNÓSTICO" onPress={onDiagnosis} /> : null}
      </View>
    )
  }
  const notice = exchangeRateNotice(response.exchange_rate)
  return (
    <>
      {response.modelos.map((model) => <PortalModelCard key={model.id} model={model} />)}
      {response.fuente_precios ? <Text style={styles.meta}>{portalSourceLabel(response.fuente_precios)}</Text> : null}
      {notice.summary ? <Text style={styles.meta}>{notice.summary}</Text> : null}
      {notice.warning ? <Alert variant="warning">{notice.warning}</Alert> : null}
    </>
  )
}

const styles = StyleSheet.create({
  section: { minHeight: 240, gap: 16 },
  empty: { minHeight: 360, justifyContent: 'center', padding: 20, gap: 12, borderWidth: 1,
    borderColor: colors.borderDefault, borderRadius: radii.card, backgroundColor: colors.surface, ...shadows.card },
  title: { color: colors.textPrimary, fontSize: 17, fontWeight: '600', textAlign: 'center' },
  meta: { color: colors.textSecondary, fontSize: 13 },
})
