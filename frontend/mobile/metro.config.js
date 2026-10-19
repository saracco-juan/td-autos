const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

// `@shared/*` (tsconfig paths) points at frontend/shared, outside this project root,
// so Metro has to watch that folder to bundle it.
config.watchFolders = [...config.watchFolders, path.resolve(__dirname, '../shared')]

module.exports = config
