import { StyleSheet, View } from 'react-native'

import Alert from '../../components/Alert'
import Button from '../../components/Button'
import { ACTION_LABELS } from '@shared/checklist/inspection/copy'

type Props = {
  // The critical-pending warning is open: the bar offers FINALIZAR IGUAL / SEGUIR REVISANDO (07b).
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

// The bar pinned above the tab bar (Figma 07): PASO SIGUIENTE (left, not on the last step) and FINALIZAR (right),
// with the finish error above the buttons (07j). Mobile has no PASO ANTERIOR: the pills move back.
export default function ActionBar({
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
      {finishFailed ? <Alert variant="error">{ACTION_LABELS.finishError}</Alert> : null}
      <View style={styles.actions}>
        {warning ? (
          <>
            <View style={styles.action}>
              <Button
                label={ACTION_LABELS.finishAnyway}
                busyLabel={FINISHING}
                busy={finishing}
                onPress={onFinishAnyway}
              />
            </View>
            <View style={styles.action}>
              <Button
                label={ACTION_LABELS.keepWorking}
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
                <Button label={ACTION_LABELS.next} disabled={finishing} onPress={onNext} />
              </View>
            ) : null}
            <View style={styles.action}>
              <Button
                label={ACTION_LABELS.finish}
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
