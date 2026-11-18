import { useBuyerTabBarSpace } from '../BuyerTabIndicator'
import { useEffect, useRef, type ReactNode } from 'react'
import { Modal, ScrollView, StyleSheet, View, type ScrollViewInstance } from 'react-native'

import { pendingFlaggedByStep } from '@shared/checklist/progress'
import type { ChecklistStep } from '@shared/checklist/types'
import { colors } from '../../theme/tokens'
import Alert from '../Alert'
import ActionBar, { type ActionLabels } from './ActionBar'
import StepPanel from './StepPanel'
import StepSection from './StepSection'
import useReduceMotion from '../../lib/useReduceMotion'
import type { ChecklistFlow } from './useChecklistFlow'

const NO_MARKERS: ReadonlyMap<number, number> = new Map()

// The words of the checklist view; each checklist feature passes its own.
export type ChecklistCopy = {
  actionLabels: ActionLabels
  flagLabel: string
  saveError: string
  pendingMarkerLabel: (count: number) => string
}

type Props = {
  flow: ChecklistFlow
  steps: ChecklistStep[]
  copy: ChecklistCopy
  header: ReactNode
  // Supporting information below the sections.
  panelFooter?: ReactNode
  // Optional feature-specific follow-up.
  after?: ReactNode
}

export default function ChecklistLayout({ flow, steps, copy, header, panelFooter, after }: Readonly<Props>) {
  const bottom = useBuyerTabBarSpace()
  const reduceMotion = useReduceMotion()
  const scrollRef = useRef<ScrollViewInstance>(null)
  const positions = useRef(new Map<number, number>())
  const { selected, progress, showWarning, warningText } = flow
  const previous = useRef(selected)
  useEffect(() => {
    if (selected === previous.current) return
    previous.current = selected
    if (!selected) return
    const timer = setTimeout(() => {
      const y = positions.current.get(selected)
      if (y !== undefined) scrollRef.current?.scrollTo({ y, animated: !reduceMotion })
    }, reduceMotion ? 0 : 450)
    return () => clearTimeout(timer)
  }, [selected, reduceMotion])

  const completedCodes = new Set(flow.completed)
  const stepIndex = steps.findIndex((step) => step.numero === selected)
  const pending = showWarning ? pendingFlaggedByStep(steps, completedCodes) : NO_MARKERS

  return (
    <View style={[layoutStyles.screen, { paddingBottom: bottom, backgroundColor: colors.surface }]}>
      <ScrollView ref={scrollRef} style={layoutStyles.scroll} contentContainerStyle={styles.content}>
        {header}
        {steps.map((step, index) => (
          <View key={step.numero} onLayout={e => positions.current.set(step.numero, e.nativeEvent.layout.y)}>
            <StepSection step={progress.steps[index]} open={selected === step.numero} reduceMotion={reduceMotion}
              pendingLabel={pending.has(step.numero) ? copy.pendingMarkerLabel(pending.get(step.numero)!) : ''}
              onPress={() => flow.setSelected(selected === step.numero ? 0 : step.numero)}>
              <StepPanel
                step={step}
                completedCodes={completedCodes}
                reduceMotion={reduceMotion}
                saveFailed={flow.failedSteps.has(step.numero)}
                flagLabel={copy.flagLabel}
                saveError={copy.saveError}
                onToggle={flow.handleToggle}
              />
            </StepSection>
          </View>
        ))}
        {panelFooter}
        {after}
      </ScrollView>
      <FinishWarning text={warningText} onDismiss={flow.keepWorking} reduceMotion={reduceMotion}>
        <ActionBar
          labels={copy.actionLabels}
          warning={showWarning}
          finishing={flow.finishing}
          finishFailed={flow.finishFailed}
          hasNext={stepIndex >= 0 && stepIndex < steps.length - 1}
          onNext={() => flow.setSelected(steps[stepIndex + 1].numero)}
          onFinish={flow.requestFinish}
          onFinishAnyway={flow.finishAnyway}
          onKeepWorking={flow.keepWorking}
        />
      </FinishWarning>
    </View>
  )
}

function FinishWarning({ text, onDismiss, reduceMotion, children }: Readonly<{
  text: string | null; onDismiss: () => void; reduceMotion: boolean; children: ReactNode
}>) {
  if (!text) return children
  return (
    <Modal transparent onRequestClose={onDismiss} animationType={reduceMotion ? 'none' : 'fade'}>
      <View style={styles.overlay}><View style={styles.dialog}>
        <Alert variant="warning">{text}</Alert>
        {children}
      </View></View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingVertical: 14, backgroundColor: colors.surface, flexGrow: 1 },
  overlay: { flex: 1, justifyContent: 'center', padding: 16, backgroundColor: '#241f1c66' },
  dialog: { borderRadius: 14, padding: 12, backgroundColor: colors.surface },
})

// Shared with SummaryLayout so both views frame the content the same way.
export const layoutStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 20 },
  // Pinned under the scrolling content, above the tab bar (docs/design.md "Page layout").
  actions: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  action: { flex: 1 },
})
