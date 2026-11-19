// Decorative circled "i" for informational messages (alert.module.css `info`); the message text carries the meaning.
export default function InfoIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="8" cy="4.6" r="1" fill="currentColor" />
      <path d="M8 7.4v4.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
