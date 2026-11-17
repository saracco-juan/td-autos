/* global jest */
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}))
// Icon fonts are binary assets that the Jest environment does not register: render a plain placeholder instead.
jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native')
  const Icon = ({ name }) => <View testID={`icon-${name}`} />
  Icon.glyphMap = {}
  return { Ionicons: Icon }
})
