import { useEffect, useState } from 'react'
import { AccessibilityInfo } from 'react-native'

export default function useReduceMotion() {
  const [reduceMotion, setReduceMotion] = useState(true)

  useEffect(() => {
    let current = true
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      current = false
      setReduceMotion(enabled)
    })
    async function readPreference() {
      try {
        const enabled = await AccessibilityInfo.isReduceMotionEnabled()
        if (current && typeof enabled === 'boolean') setReduceMotion(enabled)
      } catch {
        // Keep motion reduced until the system preference is available.
      }
    }
    void readPreference()
    return () => {
      current = false
      subscription?.remove()
    }
  }, [])
  return reduceMotion
}
