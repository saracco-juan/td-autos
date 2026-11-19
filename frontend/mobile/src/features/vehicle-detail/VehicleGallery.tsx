import { useRef, useState } from 'react'
import { Image, ScrollView, type ScrollViewInstance, StyleSheet, Text, View } from 'react-native'

import type { DetailVehicle } from '@shared/vehicles/detail'
import { colors } from '../../theme/tokens'

type Props = { photos: DetailVehicle['fotos']; title: string }

export default function VehicleGallery({ photos, title }: Readonly<Props>) {
  const ordered = [...photos].sort((a, b) => a.orden - b.orden)
  const [position, setPosition] = useState(0)
  const [width, setWidth] = useState(1)
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set())
  const pager = useRef<ScrollViewInstance>(null)

  return (
    <View onLayout={({ nativeEvent }) => setWidth(Math.max(1, nativeEvent.layout.width))}>
      {ordered.length === 0 ? <View style={styles.placeholder}><Text style={styles.message}>Fotos no disponibles.</Text></View> : (
        <ScrollView horizontal pagingEnabled directionalLockEnabled ref={pager} testID="photo-pager" style={styles.gallery}
          scrollEnabled={ordered.length > 1} showsHorizontalScrollIndicator={false}
          onContentSizeChange={() => pager.current?.scrollTo({ x: position * width, animated: false })}
          scrollEventThrottle={32} onScroll={({ nativeEvent: { contentOffset, layoutMeasurement } }) => {
            if (layoutMeasurement.width > 0) {
              setPosition(Math.max(0, Math.min(ordered.length - 1, Math.round(contentOffset.x / layoutMeasurement.width))))
            }
          }}>
          {ordered.map((photo, index) => <View key={photo.id} style={[styles.page, { width }]}>
            {failed.has(photo.url) ? <Text style={styles.message}>Esta foto no está disponible.</Text> : (
              <Image testID={index === position ? 'gallery-cover' : undefined} source={{ uri: photo.url }} resizeMode="contain"
                accessibilityLabel={`Foto ${index + 1} de ${title}`} style={StyleSheet.absoluteFill}
                onError={() => setFailed(previous => new Set(previous).add(photo.url))} />
            )}
          </View>)}
        </ScrollView>
      )}
      {ordered.length > 1 && <View pointerEvents="none" style={styles.counter}>
        <Text style={styles.count}>{position + 1} / {ordered.length}</Text>
      </View>}
    </View>
  )
}

const styles = StyleSheet.create({
  gallery: { width: '100%', aspectRatio: 4 / 3 },
  placeholder: { aspectRatio: 4 / 3, justifyContent: 'center' },
  page: { justifyContent: 'center' },
  message: { textAlign: 'center', color: colors.surfaceRaised },
  counter: { alignSelf: 'flex-end', paddingHorizontal: 12, paddingVertical: 3 },
  count: { color: colors.onColor, fontSize: 12, fontVariant: ['tabular-nums'] },
})
