/* global jest */
// Icon fonts are binary assets that the Jest environment does not register: render a plain placeholder instead.
jest.mock('@expo/vector-icons', () => {
  const { View } = require('react-native')
  const Icon = ({ name }) => <View testID={`icon-${name}`} />
  Icon.glyphMap = {}
  return { Ionicons: Icon }
})
