import { StyleSheet, View } from 'react-native'

import Alert from '../Alert'
import Button from '../Button'

// The words of the bar; each checklist feature passes its own.
export type ActionLabels = {
  next: string
  finish: string
  finishAnyway: string
  keepWorking: string
  // Alert shown above the buttons when finishing failed.
  finishError: string
}

type Props = {
  labels: ActionLabels
  // The flagged-pending warning is open: the bar offers finishAnyway / keepWorking.
  warning: boolean
  finishing: boolean
  finishFailed: boolean
  hasNext: boolean
  onNext: () => void
  onFinish: () => void
  onFinishAnyway: () => void
  onKeepWorking: () => void
}

const FINISHING = 'FINALIZANDO…'

// The bar pinned above the tab bar: next (left, not on the last step) and finish (right), with the finish error
// above the buttons. Mobile has no previous button: the pills move back.
export default function ActionBar({
  labels,
  warning,
  finishing,
  finishFailed,
  hasNext,
  onNext,
  onFinish,
  onFinishAnyway,
  onKeepWorking,
}: Readonly<Props>) {
  return (
    <View style={styles.bar}>
      {finishFailed ? <Alert variant="error">{labels.finishError}</Alert> : null}
      <View style={styles.actions}>
        {warning ? (
          <>
            <View style={styles.action}>
              <Button
                label={labels.finishAnyway}
                busyLabel={FINISHING}
                busy={finishing}
                onPress={onFinishAnyway}
              />
            </View>
            <View style={styles.action}>
              <Button
                label={labels.keepWorking}
                variant="primary"
                disabled={finishing}
                onPress={onKeepWorking}
              />
            </View>
          </>
        ) : (
          <>
            {hasNext ? (
              <View style={styles.action}>
                <Button label={labels.next} disabled={finishing} onPress={onNext} />
              </View>
            ) : null}
            <View style={styles.action}>
              <Button
                label={labels.finish}
                busyLabel={FINISHING}
                busy={finishing}
                variant="primary"
                onPress={onFinish}
              />
            </View>
          </>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: { gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  actions: { flexDirection: 'row', gap: 12 },
  action: { flex: 1 },
})
