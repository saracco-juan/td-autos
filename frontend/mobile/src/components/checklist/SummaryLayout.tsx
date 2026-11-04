import { Children, useEffect, useRef, type ReactNode } from 'react'
import { ScrollView, View, type ScrollViewInstance } from 'react-native'

import { layoutStyles } from './ChecklistLayout'

type Props = {
  header: ReactNode
  summary: ReactNode
  // The buttons of the pinned row, left to right; each takes an equal share.
  children: ReactNode
}

// The summary view: scrolling header and summary, with the action buttons pinned below.
export default function SummaryLayout({ header, summary, children }: Readonly<Props>) {
  const scrollRef = useRef<ScrollViewInstance>(null)

  // The summary starts at the top of the scroll.
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false })
  }, [])

  return (
    <View style={layoutStyles.screen}>
      <ScrollView ref={scrollRef} style={layoutStyles.scroll} contentContainerStyle={layoutStyles.content}>
        {header}
        {summary}
      </ScrollView>
      <View style={layoutStyles.actions}>
        {Children.toArray(children).map((child) => (
          // toArray assigns each child a stable key.
          <View key={(child as { key?: string }).key} style={layoutStyles.action}>
            {child}
          </View>
        ))}
      </View>
    </View>
  )
}
