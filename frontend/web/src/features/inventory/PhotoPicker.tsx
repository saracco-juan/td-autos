import { useId, useRef } from 'react'
import buttonStyles from '../../components/button.module.css'
import styles from './PhotoPicker.module.css'
import type { PhotoDraft } from './usePhotoDraft'
import { PHOTOS_MIN } from './vehicleFields'

// Id of the file input: the form moves the focus here when the photos are what failed.
export const PHOTO_INPUT_ID = 'vehicle-fotos'

type Props = {
  draft: PhotoDraft
  // Validation or server messages about the photos as a whole.
  errors?: string[]
}

// Photo panel of the vehicle form (Figma 38:923 / 2119:1841 "Right"): counter, thumbnails and the add control.
// The first photo is the cover; new files show before they are uploaded.
export default function PhotoPicker({ draft, errors }: Props) {
  const { kept, added, rejections, count, addFiles, removeKept, removeAdded } = draft
  const titleId = useId()
  const messagesId = useId()
  const inputRef = useRef<HTMLInputElement>(null)

  const items = [
    ...kept.map((photo) => ({ id: `saved-${photo.id}`, src: photo.url, remove: () => removeKept(photo.id) })),
    ...added.map((photo) => ({ id: `new-${photo.key}`, src: photo.url, remove: () => removeAdded(photo.key) })),
  ]
  const messages = [...(errors ?? []), ...rejections.filter((message) => !errors?.includes(message))]

  return (
    <section aria-labelledby={titleId} className={styles.panel}>
      <div className={styles.card}>
        <h2 id={titleId} className={styles.title}>
          Imágenes
        </h2>
        <p aria-live="polite" className={styles.counter}>
          {count < PHOTOS_MIN ? `${count} de ${PHOTOS_MIN} imágenes cargadas.` : `${count} imágenes cargadas.`}
        </p>
        {items.length > 0 ? (
          <ul aria-label="Imágenes del vehículo" className={styles.grid}>
            {items.map((item, index) => (
              <li key={item.id} className={styles.thumb}>
                <img src={item.src} alt={`Foto ${index + 1}`} className={styles.image} />
                {index === 0 ? <span className={styles.cover}>Portada</span> : null}
                <button
                  type="button"
                  className={styles.remove}
                  aria-label={`Quitar foto ${index + 1}`}
                  onClick={() => {
                    item.remove()
                    // The thumbnail that held the focus is gone: keep it inside the panel.
                    inputRef.current?.focus()
                  }}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {messages.length > 0 ? (
          <ul id={messagesId} className={styles.errors}>
            {messages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        ) : null}
      </div>
      <label className={`${buttonStyles.button} ${buttonStyles.secondary} ${styles.add}`}>
        AGREGAR IMAGEN
        <input
          ref={inputRef}
          id={PHOTO_INPUT_ID}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className={styles.fileInput}
          aria-invalid={errors ? true : undefined}
          aria-describedby={messages.length > 0 ? messagesId : undefined}
          onChange={(event) => {
            addFiles(Array.from(event.target.files ?? []))
            // The same file can be picked again after it was removed.
            event.target.value = ''
          }}
        />
      </label>
    </section>
  )
}
