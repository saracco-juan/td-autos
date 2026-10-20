import type { ChecklistSummary } from '@shared/checklist/progress'
import { FLAG_LABEL, SUMMARY_LABELS } from '@shared/checklist/transfer/copy'
import { summaryMessage, summaryPendingItems } from '@shared/checklist/transfer/summaryMessage'
import Alert from '../../components/Alert'
import { PendingCard, ProgressCard } from '../../components/checklist/SummaryCards'

// Body of the summary view (Figma 09c / 09d / 09e): result message, progress per stage, and the pending steps.
// Everything here is read-only; ticking happens in the checklist. The screen draws the header and the button.
export default function TransferSummary({ progress }: Readonly<{ progress: ChecklistSummary }>) {
  const message = summaryMessage(progress)
  const { mandatory, items } = summaryPendingItems(progress)

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
          title={mandatory ? SUMMARY_LABELS.pendingMandatoryTitle : SUMMARY_LABELS.pendingTitle}
          hint={mandatory ? SUMMARY_LABELS.pendingMandatoryHint : undefined}
          flagLabel={FLAG_LABEL}
          items={items}
        />
      ) : null}
    </>
  )
}
