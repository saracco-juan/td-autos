import { useEffect, useLayoutEffect, useRef, useState } from 'react'

// A single live form exits before React changes its step, then the next card enters.
export default function useDealerRegistrationStep() {
  const [step, setStep] = useState(0)
  const [changing, setChanging] = useState(false)
  const [instant, setInstant] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<Animation | null>(null)
  const pendingEntry = useRef<number | null>(null)
  const busy = useRef(false)

  const goToStep = async (next: number, keyboard = false) => {
    if (next === step || busy.current) return
    const card = containerRef.current
    const reduce = keyboard || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    setInstant(Boolean(reduce))
    if (!card?.animate || reduce) {
      setStep(next)
      return
    }

    const direction = next > step ? 1 : -1
    busy.current = true
    pendingEntry.current = direction
    setChanging(true)
    const exit = card.animate([
      { transform: 'translateX(0)', opacity: 1 },
      { transform: `translateX(${-direction * 100}%)`, opacity: 0 },
    ], { duration: 200, easing: 'cubic-bezier(0.77, 0, 0.175, 1)', fill: 'forwards' })
    animationRef.current = exit
    try {
      await exit.finished
      if (animationRef.current === exit) setStep(next)
    } catch {
      if (animationRef.current !== exit) return
      animationRef.current = null
      pendingEntry.current = null
      busy.current = false
      setChanging(false)
    }
  }

  useLayoutEffect(() => {
    const direction = pendingEntry.current
    const card = containerRef.current
    if (direction === null || !card) return
    pendingEntry.current = null
    animationRef.current?.cancel()
    const entry = card.animate([
      { transform: `translateX(${direction * 100}%)`, opacity: 0 },
      { transform: 'translateX(0)', opacity: 1 },
    ], { duration: 250, easing: 'cubic-bezier(0.32, 0.72, 0, 1)' })
    animationRef.current = entry
    void entry.finished.catch(() => {}).finally(() => {
      if (animationRef.current !== entry) return
      entry.cancel()
      animationRef.current = null
      busy.current = false
      setChanging(false)
    })
  }, [step])

  useEffect(() => () => {
    const animation = animationRef.current
    animationRef.current = null
    pendingEntry.current = null
    busy.current = false
    animation?.cancel()
  }, [])

  return { step, changing, instant, containerRef, goToStep }
}
