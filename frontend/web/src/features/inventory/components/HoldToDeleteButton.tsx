import { useCallback, useEffect, useId, useRef, useState, type Ref } from 'react'
import Button from '../../../components/Buttons/Button'
import accessibility from '../../../styles/accessibility.module.css'
import styles from './HoldToDeleteButton.module.css'

type Props = {
  onConfirm: () => void | Promise<void>
  buttonRef?: Ref<HTMLButtonElement>
  ariaLabel?: string
}

// A short click never deletes. Releasing, leaving or losing focus cancels the hold.
export default function HoldToDeleteButton({ onConfirm, buttonRef, ariaLabel = 'ELIMINAR' }: Props) {
  const descriptionId = useId()
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const confirmed = useRef(false)
  const [holding, setHolding] = useState(false)
  const [keyboard, setKeyboard] = useState(false)

  const cancel = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = undefined
    setHolding(false)
  }, [])

  useEffect(() => {
    window.addEventListener('blur', cancel)
    return () => {
      window.removeEventListener('blur', cancel)
      clearTimeout(timer.current)
    }
  }, [cancel])

  const start = (fromKeyboard: boolean) => {
    if (timer.current !== undefined || confirmed.current) return
    setKeyboard(fromKeyboard)
    setHolding(true)
    timer.current = setTimeout(() => {
      timer.current = undefined
      confirmed.current = true
      setHolding(false)
      void Promise.resolve(onConfirm()).then(
        () => { confirmed.current = false },
        () => { confirmed.current = false },
      )
    }, 2000)
  }

  return <>
    <Button ref={buttonRef} type="button" variant="danger" className={styles.hold}
      aria-label={ariaLabel} aria-describedby={descriptionId}
      data-holding={holding || undefined} data-keyboard={keyboard || undefined}
      onPointerDown={(event) => { if (event.button > 0 || event.isPrimary === false) return; start(false) }}
      onPointerUp={cancel} onPointerLeave={cancel} onPointerCancel={cancel} onBlur={cancel}
      onKeyDown={(event) => {
        if (event.key === 'Escape') { cancel(); return }
        if (event.key !== ' ' && event.key !== 'Enter') return
        event.preventDefault()
        if (!event.repeat) start(true)
      }}
      onKeyUp={(event) => {
        if (event.key !== ' ' && event.key !== 'Enter') return
        event.preventDefault()
        cancel()
      }}>
      <span className={styles.progress} aria-hidden="true" />
      <span className={styles.label}>{holding ? 'MANTENER PARA ELIMINAR' : 'ELIMINAR'}</span>
    </Button>
    <span id={descriptionId} className={accessibility.visuallyHidden}>
      Mantené presionado durante dos segundos. Con teclado, mantené Espacio o Enter. Soltá para cancelar. Se borran el vehículo y sus fotos; no se puede deshacer.
    </span>
    {holding ? <span role="status" className={accessibility.visuallyHidden}>
      Confirmando eliminación. Soltá para cancelar.
    </span> : null}
  </>
}
