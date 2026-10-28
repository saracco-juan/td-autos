import { useState } from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'

import type { DetailVehicle } from '@shared/vehicles/detail'
import { colors, radii } from '../../theme/tokens'

type Props = { photos: DetailVehicle['fotos']; title: string }

// Cover photo plus a row of thumbnails (Figma 2373:9996). Photos come ordered by `orden`; a photo that fails to
// load is replaced by a text message, never by a stock image.
export default function VehicleGallery({ photos, title }: Readonly<Props>) {
  const ordered = [...photos].sort((a, b) => a.orden - b.orden)
  const [selectedId, setSelectedId] = useState<number | undefined>(undefined)
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set())
  const selected = ordered.find((photo) => photo.id === selectedId) ?? ordered[0]
  const markFailed = (url: string) => setFailed((previous) => new Set(previous).add(url))

  return (
    <View accessibilityLabel="Fotos del vehículo" style={styles.gallery}>
      {!selected || failed.has(selected.url) ? (
        <View accessibilityRole="text" style={[styles.cover, styles.placeholder]}>
          <Text style={styles.placeholderText}>{selected ? 'Esta foto no está disponible.' : 'Fotos no disponibles.'}</Text>
        </View>
      ) : (
        <Image
          testID="gallery-cover"
          source={{ uri: selected.url }}
          accessibilityLabel={`Foto ${ordered.indexOf(selected) + 1} de ${title}`}
          onError={() => markFailed(selected.url)}
          style={styles.cover}
        />
      )}
      {ordered.length > 0 ? (
        <View style={styles.thumbnails}>
          {ordered.map((photo, index) => (
            <Pressable
              key={photo.id}
              accessibilityRole="button"
              accessibilityLabel={`Ver foto ${index + 1} de ${title}`}
              accessibilityState={{ selected: photo.id === selected?.id }}
              onPress={() => setSelectedId(photo.id)}
              style={[styles.thumbnail, photo.id === selected?.id && styles.thumbnailSelected]}
            >
              {failed.has(photo.url) ? (
                <Text style={styles.thumbnailFallback}>Foto {index + 1} no disponible</Text>
              ) : (
                <Image
                  testID={`gallery-thumbnail-${index + 1}`}
                  source={{ uri: photo.url }}
                  onError={() => markFailed(photo.url)}
                  style={StyleSheet.absoluteFill}
                />
              )}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  gallery: { gap: 12 },
  // 16:10 as the recommendation card image.
  cover: { width: '100%', aspectRatio: 16 / 10, borderRadius: radii.card, backgroundColor: colors.surfaceRaised },
  placeholder: { alignItems: 'center', justifyContent: 'center', padding: 16 },
  placeholderText: { color: colors.textSecondary, fontSize: 14, textAlign: 'center' },
  thumbnails: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumbnail: {
    width: 72,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: radii.field,
    backgroundColor: colors.surfaceRaised,
  },
  thumbnailSelected: { borderWidth: 2, borderColor: colors.charcoal },
  thumbnailFallback: { color: colors.textSecondary, fontSize: 10, textAlign: 'center', paddingHorizontal: 4 },
})
