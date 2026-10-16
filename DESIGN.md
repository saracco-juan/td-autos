# TD Autos — design rules

Visual and interaction rules for every web screen (and the mobile app where the pattern exists). Read this file before building or changing a screen. Figma (`TD Autos · Wireframes High v2`, see `AGENTS.md`) is the visual source of truth; these rules cover what Figma does not say and win over it when they conflict, and every difference is logged for the Figma sync described in `AGENTS.md`.

## Copy

- User-facing copy is Spanish, Argentine voseo ("Registrá tu cuenta"), sentence case for titles and labels, buttons in uppercase, links in sentence case.
- No technical subtitles or jargon on screen.

## Page layout

- Pages use the full width of the window with small fluid side gutters (`clamp(16px, 3vw, 40px)`). No narrow centered column; only auth cards, long reading text, recommendations (1200 px) and the buyer flows that do not need the width (diagnosis, inspection and transfer: `FlowLayout narrow`, a centered column up to 1040 px with its action bar) keep a max width.
- Every screen fills the viewport height: header on top, footer at the bottom, content in between with no empty band under the actions.
- On flow and form screens (diagnosis, transfer and inspection checklists, subscription, vehicle form, CSV import, dealer edit), the primary actions sit in a bar pinned to the bottom of the content area, never in the middle of the page. If the content is taller than the screen, the content scrolls and the action bar stays visible.

## Responsive

- Use fluid units for layout: `%`, `fr`, `min()`, `max()`, `clamp()`, `width: 100%` with `max-width`, `minmax(min(100%, X), 1fr)` grids and `flex-wrap`. Fixed pixels only for borders, radii, icons, small gaps and font sizes.
- Check every screen at 1280×800, 768×1024 and 375×812 in a browser before handing it over. No horizontal page scroll at any width; no text overflowing its box.
- Two-column layouts stack below ~800 px. Under 800 px the header collapses into a MENÚ toggle.

## Lists and tables

- Result lists and tables never scroll the page. The list fills the free height of the screen.
- Lists are paginated, not scrolled. The pager has a "Mostrar" selector (10, 25, 50; 10 by default): the page size is the user's choice and never changes with the window size or the zoom. When the chosen rows do not fit the screen, the list box scrolls inside (never the page); a table whose columns cannot fit on a phone may scroll sideways inside its own box.
- The pager sits at the bottom-right of the list, on the same row as the list's actions (for example CARGAR VEHÍCULO / IMPORTAR CSV on the left, pager on the right). Style: the pages are one segmented button group (‹ 1 2 3 … N ›) followed by "Mostrar [10]" at the right edge; numbers in secondary text, the current page in the table header tone (`--surface-raised`), never black.
- Row actions and the pager use the button group style (`components/buttonGroup.module.css`): white surface, thin border, thin dividers, soft shadow, radius 10, and a subtle hover in the table header tone. Row actions are separate buttons 8 px apart, ending at the cell padding of the table's right edge; an unavailable action stays as a greyed button so rows line up. Focus rings are soft (header tone), never a dark outline.
- Tables are only as wide as their fields need, with room to breathe (about 20 px of horizontal cell padding): fixed pixel column widths (`table-layout: fixed`, table width = sum of the columns), every row the same height, compact row actions (smaller than page buttons) on one line. The title, the table and the pager form a column centered on the page; the pager aligns with the table's right edge.
- The table box takes the free height of the screen and has no surface of its own (no background, border or shadow): the table itself carries the white rows and the rounded border, so it looks as tall as its rows. The pager stays pinned at the bottom of the screen. When the chosen rows do not fit, the box scrolls inside. Reserve the scrollbar lane (`scrollbar-gutter: stable`) so a vertical scrollbar never causes a sideways one. (Decided 2026-10-16 over a box sized by its rows, whose height and pager jumped with the row count.)
- On narrow screens a table drops its least needed columns (first contact, then place) instead of squeezing all of them; long cell text ends in an ellipsis with the full text in `title`.
- A search box for a list goes in the header row beside the title when there is room; on phones it drops under the title. Exception: recommendations follow Figma 38:168, with the search field full width under the header and no BUSCAR button (Enter searches).
- Recommendations show a 3 x 3 page (9 cards, fixed) in a centered column up to 1200 px. Cards are as tall as their content, with a 16:10 image; what does not fit scrolls inside the list box. Tablets show two columns, phones one card per row. (Decided 2026-10-16 over stretching two rows to fill the screen.)
- Scroll containers keep their rounded box: the frame clips, the inner region scrolls, slim inset scrollbar in the border color.

## Buttons

- Buyer screens (diagnosis, recommendations, inspection, transfer, profile) use the soft button (`buttonStyles.soft` on top of the variant): white surface, thin light border, soft shadow, dark grey label, subtle hover in the table header tone, soft focus ring. The primary keeps a slightly stronger border and a bolder label.

## Feedback

- Message boxes (error, success, warning) have a tinted background and dark text: reuse `frontend/web/src/components/alert.module.css`.
- Loading is shown on the component that waits, never full screen: a submit button shows its busy state; a section that loads data shows a loader centered horizontally and vertically inside that section.
- Selections (checkbox, toggle, chip) change at once and save in the background: no loader, no blocking.
- Figma covers layout and business states only; loaders and service errors live in code and get no Figma frames.

## Platforms

- A screen decision applies to web and mobile by default; only layout that exists on one platform (desktop sidebar, bottom tab bar) stays on that platform.
