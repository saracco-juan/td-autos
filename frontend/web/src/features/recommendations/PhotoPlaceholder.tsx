import styles from './VehicleCard.module.css'

// Neutral block shown where a photo is missing or failed to load; takes the 16:10 box of the photo.
export default function PhotoPlaceholder({ className }: { className?: string }) {
  return (
    <div className={[styles.image, styles.placeholder, className].filter(Boolean).join(' ')}>
      <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" focusable="false" fill="none"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 16V12l1.6-4.2A2 2 0 0 1 8.5 6.5h7a2 2 0 0 1 1.9 1.3L19 12v4" />
        <path d="M3.5 12h17M5 16h14v2.5H17V16M7 16v2.5H5V16" />
        <circle cx="8" cy="13.8" r=".6" /><circle cx="16" cy="13.8" r=".6" />
      </svg>
      <span>Sin fotos</span>
    </div>
  )
}
