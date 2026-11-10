import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})

// jsdom has no object URLs; the previews of picked photos need them.
if (!URL.createObjectURL) {
  URL.createObjectURL = () => 'blob:preview'
  URL.revokeObjectURL = () => {}
}

// jsdom does not implement viewport media queries or element scrolling.
// Individual responsive tests can override these defaults with their own mocks.
if (!window.matchMedia) {
  window.matchMedia = (media: string) => Object.assign(new EventTarget(), {
    media,
    matches: false,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
  }) as MediaQueryList
}
if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = () => {}
}
