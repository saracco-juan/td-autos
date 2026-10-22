const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

// `@shared/*` (tsconfig paths) points at frontend/shared, outside this project root,
// so Metro has to watch that folder to bundle it.
config.watchFolders = [...config.watchFolders, path.resolve(__dirname, '../shared')]
// frontend/shared has no node_modules: imports from its files (including Babel's runtime helpers) resolve here.
config.resolver.nodeModulesPaths = [...(config.resolver.nodeModulesPaths ?? []), path.resolve(__dirname, 'node_modules')]

module.exports = config
