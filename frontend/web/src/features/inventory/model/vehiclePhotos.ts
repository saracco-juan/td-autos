export const PHOTO_MAX_BYTES = 5 * 1024 * 1024
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export type PhotoCheck = {
  accepted: File[]
  // One message per rejected file (naming it), plus one when the limit cuts the batch.
  rejections: string[]
}

// Client-side twin of the server photo rules: JPG, PNG or WebP, 5 MB each, and at most `max` photos in total.
export function checkNewFiles(files: File[], currentCount: number, max: number): PhotoCheck {
  const accepted: File[] = []
  const rejections: string[] = []
  let overLimit = false

  for (const file of files) {
    if (!PHOTO_TYPES.includes(file.type)) rejections.push(`${file.name}: tiene que ser una imagen JPG, PNG o WebP.`)
    else if (file.size > PHOTO_MAX_BYTES) rejections.push(`${file.name}: pesa más de 5 MB.`)
    else if (currentCount + accepted.length >= max) overLimit = true
    else accepted.push(file)
  }
  if (overLimit) rejections.push(`Podés cargar hasta ${max} fotos.`)

  return { accepted, rejections }
}
