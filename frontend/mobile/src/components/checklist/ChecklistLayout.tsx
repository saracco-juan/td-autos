import { useEffect, useRef, type ReactNode } from 'react'
import { ScrollView, StyleSheet, View, type ScrollViewInstance } from 'react-native'

import { pendingFlaggedByStep } from '@shared/checklist/progress'
import type { ChecklistStep } from '@shared/checklist/types'
import { colors } from '../../theme/tokens'
import Alert from '../Alert'
import ActionBar, { type ActionLabels } from './ActionBar'
import StepPanel from './StepPanel'
import StepPills from './StepPills'
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
  // Extra content under the items, inside the step card.
  panelFooter?: ReactNode
  // Extra content under the step card.
  after?: ReactNode
}

// The checklist view: scrolling header, warning, pills and step card, with the action bar pinned below.
export default function ChecklistLayout({ flow, steps, copy, header, panelFooter, after }: Readonly<Props>) {
  const scrollRef = useRef<ScrollViewInstance>(null)
  const { selected, progress, showWarning, warningText } = flow

  // A new step starts at the top of the scroll.
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false })
  }, [selected])

  const completedCodes = new Set(flow.completed)
  const stepIndex = steps.findIndex((step) => step.numero === selected)
  const step = steps[stepIndex]

  return (
    <View style={layoutStyles.screen}>
      <ScrollView ref={scrollRef} style={layoutStyles.scroll} contentContainerStyle={layoutStyles.content}>
        {header}
        {warningText ? <Alert variant="warning">{warningText}</Alert> : null}
        <StepPills
          steps={progress.steps}
          selected={selected}
          pendingFlagged={showWarning ? pendingFlaggedByStep(steps, completedCodes) : NO_MARKERS}
          pendingLabel={copy.pendingMarkerLabel}
          onSelect={flow.setSelected}
        />
        {step ? (
          <StepPanel
            step={step}
            completedCodes={completedCodes}
            saveFailed={flow.failedSteps.has(step.numero)}
            flagLabel={copy.flagLabel}
            saveError={copy.saveError}
            onToggle={flow.handleToggle}
          >
            {panelFooter}
          </StepPanel>
        ) : null}
        {after}
      </ScrollView>
      <ActionBar
        labels={copy.actionLabels}
        warning={showWarning}
        finishing={flow.finishing}
        finishFailed={flow.finishFailed}
        hasNext={stepIndex < steps.length - 1}
        onNext={() => flow.setSelected(steps[stepIndex + 1].numero)}
        onFinish={flow.requestFinish}
        onFinishAnyway={flow.finishAnyway}
        onKeepWorking={flow.keepWorking}
      />
    </View>
  )
}

// Shared with SummaryLayout so both views frame the content the same way.
export const layoutStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 20 },
  // Pinned under the scrolling content, above the tab bar (docs/design.md "Page layout").
  actions: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  action: { flex: 1 },
})
