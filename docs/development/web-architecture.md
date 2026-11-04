# Web frontend organization

The web app uses feature folders for product responsibilities and shared React components for repeated interface behavior. React recommends composition and splitting components by responsibility; it does not prescribe a directory structure or require tests and CSS to live in particular folders.

References: [Thinking in React](https://react.dev/learn/thinking-in-react), [Importing and Exporting Components](https://react.dev/learn/importing-and-exporting-components).

## Source layout

All paths below are relative to `frontend/web/src`.

| Folder | Responsibility |
| --- | --- |
| `app/` | Router, application shell, layouts and footer. |
| `features/<feature>/pages/` | Route-level screens and orchestration. |
| `features/<feature>/components/` | UI owned by that feature. |
| `features/<feature>/hooks/` | Feature-specific React state/effect hooks. |
| `features/<feature>/api/` | HTTP operations for the feature. |
| `features/<feature>/model/` | Types, validation, formatting and feature helpers. |
| `features/<feature>/assets/` | Feature-owned images and SVG files. |
| `features/<feature>/styles/` | Feature-wide styles with no single component owner. |
| `components/` | UI reused across features, grouped by component or domain (for example `Buttons/` and `checklist/`). |
| `hooks/` | Hooks shared by interface components. |
| `styles/` | Shared presentation styles without a single component owner. |
| `lib/` | Infrastructure such as HTTP, configuration and browser utilities. |
| `test/` | Web tests, shared setup and fixtures. Tests mirror the feature/app/component organization. |

Auth retains its existing login, recovery, dealer and session boundaries, with responsibilities organized inside each area. Create only folders that have actual contents. Component/page CSS modules stay beside their TSX owner; separate them only when several owners share the styles. Business rules needed by both clients continue to live in `frontend/shared`.

## Shared actions

`components/Buttons/Button.tsx` renders a native button; `ButtonLink.tsx` renders a React Router link; `ButtonAnchor.tsx` renders an external anchor. Their optional `variant` is `primary`, `secondary`, `danger` or `success`. Native props, refs, disabled/busy states, navigation state and custom layout classes are forwarded. Button type follows native behavior: explicitly use `type="button"` for actions inside forms that must not submit.

```tsx
import Button from '../../../components/Buttons/Button'
import ButtonLink from '../../../components/Buttons/ButtonLink'

<Button type="submit" variant="primary" disabled={saving}>GUARDAR</Button>
<ButtonLink to="/recomendaciones" state={context}>VER RECOMENDADOS</ButtonLink>
```

`BackLink` remains the shared back navigation control. Existing styles and the 550 ms hover are preserved. Specialized controls (radio choices, favorite hearts, carousel controls, tabs and file-picker labels) keep their native semantics and dedicated styles; a visually similar label is not a button. Do not add a general polymorphic component or copy shared styles into a feature.

## Tests and safe changes

Tests live in `test/features/<feature>`, `test/components`, `test/app` and `test/lib`. Fixtures live in `test/fixtures/<feature>`, while setup and shared comparison fixtures stay directly under `test`. Tests import actual implementations and mock the same module paths used by production consumers. Shared-client tests remain in `frontend/shared` and are still included by the web Vitest configuration.

Run `npm run test`, `npm run lint` and `npm run build` from `frontend/web`; run `node scripts/check-duplication.mjs` from the repository root. After structural changes, smoke-test existing routes, Back navigation, form submissions, filter controls and comparison selection. A structure-only refactor must preserve the UI, state ownership and API calls.
