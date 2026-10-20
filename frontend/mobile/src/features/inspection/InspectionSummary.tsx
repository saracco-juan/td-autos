import type { ChecklistSummary } from '@shared/checklist/progress'
import { SUMMARY_LABELS, FLAG_LABEL } from '@shared/checklist/inspection/copy'
import { summaryMessage, summaryPendingItems } from '@shared/checklist/inspection/summaryMessage'
import Alert from '../../components/Alert'
import { PendingCard, ProgressCard } from '../../components/checklist/SummaryCards'

// Body of the summary view (Figma 07c / 07d / 07e): result message, progress per step, and the pending items.
// Everything here is read-only; ticking happens in the checklist. The screen draws the header and the buttons.
export default function InspectionSummary({ progress }: Readonly<{ progress: ChecklistSummary }>) {
  const message = summaryMessage(progress)
  const { critical, items } = summaryPendingItems(progress)

  return (
    <>
      <Alert variant={message.tone}>{message.text}</Alert>
      <ProgressCard
        title={SUMMARY_LABELS.progressTitle}
        steps={progress.steps}
        completed={progress.completed}
        total={progress.total}
      />
      {items.length > 0 ? (
        <PendingCard
          title={critical ? SUMMARY_LABELS.pendingCriticalTitle : SUMMARY_LABELS.pendingTitle}
          hint={critical ? SUMMARY_LABELS.pendingCriticalHint : undefined}
          flagLabel={FLAG_LABEL}
          items={items}
        />
      ) : null}
    </>
  )
}
