import styles from './admin.module.css'
import type { StateTag as Tag } from './format'

// Small pill under a state label: a rejected receipt, an expired subscription or its grace period.
export default function StateTag({ tag }: { tag: Tag }) {
  return (
    <span className={styles.stateTag} data-tone={tag.tone}>
      {tag.label}
    </span>
  )
}
