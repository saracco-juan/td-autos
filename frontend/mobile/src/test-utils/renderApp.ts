import { renderRouter } from 'expo-router/testing-library'

// Renders the real route tree (src/app) at `url`. Tests mock the API and the token storage around it.
// With the async RNTL 14 render, the router helpers live on the returned promise, so they are re-exposed here.
export async function renderApp(url: string) {
  const view = renderRouter('./src/app', { initialUrl: url })
  await view
  return { getPathname: () => view.getPathname() }
}
