import { useCallback, useEffect, useRef, useState } from 'react'
import type { FotoVehiculo } from './types'
import { PHOTOS_MAX } from './vehicleFields'
import { checkNewFiles } from './vehiclePhotos'

export type AddedPhoto = { key: number; file: File; url: string }

export type PhotoDraft = {
  // Saved photos still kept (edit); the ones removed move to `removedIds`.
  kept: FotoVehiculo[]
  added: AddedPhoto[]
  removedIds: number[]
  // Messages of the last batch of files the client refused.
  rejections: string[]
  count: number
  addFiles: (files: File[]) => void
  removeKept: (id: number) => void
  removeAdded: (key: number) => void
}

// Photos of the form: saved ones to keep or drop, new files with a preview URL that is revoked as soon as it is not needed.
export function usePhotoDraft(initial: FotoVehiculo[] = []): PhotoDraft {
  const [kept, setKept] = useState(initial)
  const [removedIds, setRemovedIds] = useState<number[]>([])
  const [added, setAdded] = useState<AddedPhoto[]>([])
  const [rejections, setRejections] = useState<string[]>([])
  const nextKey = useRef(0)
  // The latest list, so the unmount cleanup revokes what is on screen then, not what was there at mount.
  const addedRef = useRef(added)
  useEffect(() => {
    addedRef.current = added
  }, [added])
  useEffect(
    () => () => {
      for (const photo of addedRef.current) URL.revokeObjectURL(photo.url)
    },
    [],
  )

  const count = kept.length + added.length

  const addFiles = useCallback(
    (files: File[]) => {
      const { accepted, rejections: refused } = checkNewFiles(files, count, PHOTOS_MAX)
      setRejections(refused)
      setAdded((current) => [
        ...current,
        ...accepted.map((file) => ({ key: nextKey.current++, file, url: URL.createObjectURL(file) })),
      ])
    },
    [count],
  )

  const removeKept = useCallback((id: number) => {
    setRejections([])
    setKept((current) => current.filter((photo) => photo.id !== id))
    setRemovedIds((current) => [...current, id])
  }, [])

  const removeAdded = useCallback((key: number) => {
    setRejections([])
    const photo = addedRef.current.find((candidate) => candidate.key === key)
    if (photo) URL.revokeObjectURL(photo.url)
    setAdded((current) => current.filter((candidate) => candidate.key !== key))
  }, [])

  return { kept, added, removedIds, rejections, count, addFiles, removeKept, removeAdded }
}
