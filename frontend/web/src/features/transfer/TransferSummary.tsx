import type { Ref } from 'react'
import buttonStyles from '../../components/button.module.css'
import ChecklistCardGrid from '../../components/checklist/ChecklistCardGrid'
import ChecklistProgressCard from '../../components/checklist/ChecklistProgressCard'
import barStyles from '../../components/checklist/pinnedBar.module.css'
import { summarizeChecklist } from '../../components/checklist/progress'
import screenStyles from '../../components/screen.module.css'
import { toChecklistSteps } from './checklistSteps'
import TransferHeader from './TransferHeader'
import type { TransferStage } from './types'

type Props = {
  stages: TransferStage[]
  completedCodes: string[]
  onKeepCompleting: () => void
  // The page moves the focus here when the view changes.
  titleRef?: Ref<HTMLHeadingElement>
}

// Shown after finishing. Read-only: ticking happens in the checklist.
// For now only the progress per stage; the status message and the pending lists come next.
export default function TransferSummary({ stages, completedCodes, onKeepCompleting, titleRef }: Props) {
  const progress = summarizeChecklist(toChecklistSteps(stages), completedCodes)

  return (
    <div className={screenStyles.page}>
      <TransferHeader completed={progress.completed} total={progress.total} titleRef={titleRef ?? null} />

      <ChecklistCardGrid single>
        <ChecklistProgressCard
          title="Avance por etapa"
          steps={progress.steps}
          completed={progress.completed}
          total={progress.total}
        />
      </ChecklistCardGrid>

      <div className={barStyles.bar}>
        <div className={barStyles.actions}>
          <button
            type="button"
            className={`${buttonStyles.button} ${buttonStyles.primary} ${barStyles.action}`}
            onClick={onKeepCompleting}
          >
            SEGUIR COMPLETANDO
          </button>
        </div>
      </div>
    </div>
  )
}
