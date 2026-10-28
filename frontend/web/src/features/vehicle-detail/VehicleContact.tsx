import { useEffect, useRef, useState } from 'react'
import alertStyles from '../../components/alert.module.css'
import buttonStyles from '../../components/button.module.css'
import { HttpError } from '../../lib/http'
import { contactVehicle } from './api'

export default function VehicleContact({ vehicleId, available }: { vehicleId: number; available: boolean }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const active = useRef(true)
  const pending = useRef(false)
  useEffect(() => {
    active.current = true
    return () => { active.current = false }
  }, [])

  async function contact() {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setError(null)
    try {
      const { url } = await contactVehicle(vehicleId)
      // Same-tab navigation avoids popup blocking after the lead request completes.
      if (active.current) window.open(url, '_self', 'noopener,noreferrer')
    } catch (failure) {
      if (active.current) setError(failure instanceof HttpError && failure.status === 409
        ? 'WhatsApp no disponible'
        : 'No pudimos iniciar el contacto. Intentá nuevamente.')
    } finally {
      pending.current = false
      if (active.current) setBusy(false)
    }
  }

  if (!available) return <p>WhatsApp no disponible</p>
  return <>
    <button type="button" className={`${buttonStyles.button} ${buttonStyles.success}`}
      disabled={busy} aria-busy={busy} onClick={() => void contact()}>
      {busy ? 'ABRIENDO WHATSAPP…' : 'CONTACTAR POR WHATSAPP'}
    </button>
    {error ? <p role="alert" className={alertStyles.alert}>{error}</p> : null}
  </>
}
