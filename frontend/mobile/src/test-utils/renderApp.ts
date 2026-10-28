import { renderRouter } from 'expo-router/testing-library'

// Renders the real route tree (src/app) at `url`. Tests mock the API and the token storage around it.
export function renderApp(url: string) {
  return renderRouter('./src/app', { initialUrl: url })
}
