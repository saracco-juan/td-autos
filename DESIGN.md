# TD Autos — design rules

Visual and interaction rules for every web screen (and the mobile app where the pattern exists). Read this file before building or changing a screen. Figma (`TD Autos · Wireframes High v2`, see `AGENTS.md`) is the visual source of truth; these rules cover what Figma does not say and win over it when they conflict, and every difference is logged for the Figma sync described in `AGENTS.md`.

## Copy

- User-facing copy is Spanish, Argentine voseo ("Registrá tu cuenta"), sentence case for titles and labels, buttons in uppercase, links in sentence case.
- No technical subtitles or jargon on screen.

## Page layout

- Pages use the full width of the window with small fluid side gutters (`clamp(16px, 3vw, 40px)`). No narrow centered column; only auth cards and long reading text keep a max width.
- Every screen fills the viewport height: header on top, footer at the bottom, content in between with no empty band under the actions.
- On flow and form screens (diagnosis, transfer and inspection checklists, subscription, vehicle form, CSV import, dealer edit), the primary actions sit in a bar pinned to the bottom of the content area, never in the middle of the page. If the content is taller than the screen, the content scrolls and the action bar stays visible.

## Responsive

- Use fluid units for layout: `%`, `fr`, `min()`, `max()`, `clamp()`, `width: 100%` with `max-width`, `minmax(min(100%, X), 1fr)` grids and `flex-wrap`. Fixed pixels only for borders, radii, icons, small gaps and font sizes.
- Check every screen at 1280×800, 768×1024 and 375×812 in a browser before handing it over. No horizontal page scroll at any width; no text overflowing its box.
- Two-column layouts stack below ~800 px. Under 800 px the header collapses into a MENÚ toggle.

## Lists and tables

- Result lists and tables never scroll the page. The list fills the free height of the screen.
- Lists are paginated, not scrolled: the number of rows or cards per page adapts to the visible area (like MUI DataGrid `autoPageSize`), so no inner scrollbar appears on desktop. An inner scroll is only a fallback on very small screens; a table whose columns cannot fit on a phone may scroll sideways inside its own box.
- The pager sits at the bottom-right of the list, on the same row as the list's actions (for example CARGAR VEHÍCULO / IMPORTAR CSV on the left, pager on the right). Style: MUI `Pagination` (‹ 1 2 3 … N ›); the current page is a centered circle in the table header tone (`--surface-raised`), never black.
- Tables fill their box with no blank band: fixed column shares (`table-layout: fixed` with `%` widths), every row the same height (actions on one line), the page size computed from a fixed row height, and the rows stretched evenly over the box. Zooming or resizing changes how many rows fit, never the layout.
- On narrow screens a table drops its least needed columns (first contact, then place) instead of squeezing all of them; long cell text ends in an ellipsis with the full text in `title`.
- A search box for a list goes in the header row beside the title when there is room; on phones it drops under the title.
- Scroll containers keep their rounded box: the frame clips, the inner region scrolls, slim inset scrollbar in the border color.

## Feedback

- Message boxes (error, success, warning) have a tinted background and dark text: reuse `frontend/web/src/components/alert.module.css`.
- Loading is shown on the component that waits, never full screen: a submit button shows its busy state; a section that loads data shows a loader centered horizontally and vertically inside that section.
- Selections (checkbox, toggle, chip) change at once and save in the background: no loader, no blocking.
- Figma covers layout and business states only; loaders and service errors live in code and get no Figma frames.

## Platforms

- A screen decision applies to web and mobile by default; only layout that exists on one platform (desktop sidebar, bottom tab bar) stays on that platform.
