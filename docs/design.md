# TD Autos — design rules

Visual and interaction rules for every web screen (and the mobile app where the pattern exists). Read this file before building or changing a screen. Figma (`TD Autos · Wireframes High v3`, see `AGENTS.md`) is the visual source of truth; these rules cover what Figma does not say and win over it when they conflict, and every difference is logged for the Figma sync described in `AGENTS.md`.

## Navbar

- Red bar pinned to the top with a soft shadow: logo mark (the TD monogram of the favicon, red on a white tile) followed by the word "Autos" on the left (the link is named "TD Autos"), role links as pills beside it (subtle hover, a brighter pill for the current page), and on the right the account group: Perfil or Administración as a pill, the dealer name as a chip, Cerrar sesión as an outlined pill with an icon. On phones a MENÚ pill with a hamburger icon opens a panel with full-width pills.

## Copy

- User-facing copy is Spanish, Argentine voseo ("Registrá tu cuenta"), sentence case for titles and labels, buttons in uppercase, links in sentence case.
- No technical subtitles or jargon on screen.

## Page layout

- Pages use the full width of the window with small fluid side gutters (`clamp(16px, 3vw, 40px)`). No narrow centered column; only auth cards, long reading text, the admin dashboard (1040 px), the buyer profile (760 px, the width of its form card), recommendations (1200 px) and the flows that do not need the width (diagnosis, inspection, transfer and dealer verification: `FlowLayout narrow`, a centered column up to 1040 px with its action bar) keep a max width.
- Every screen fills the viewport height: header on top, footer at the bottom, content in between with no empty band under the actions.
- On flow and form screens (diagnosis, transfer and inspection checklists, subscription, vehicle form, CSV import, dealer edit), the primary actions sit in a bar pinned to the bottom of the content area, never in the middle of the page. If the content is taller than the screen, the content scrolls and the action bar stays visible.

## Responsive

- Use fluid units for layout: `%`, `fr`, `min()`, `max()`, `clamp()`, `width: 100%` with `max-width`, `minmax(min(100%, X), 1fr)` grids and `flex-wrap`. Fixed pixels only for borders, radii, icons, small gaps and font sizes.
- Check every screen at 1280×800, 768×1024 and 375×812 in a browser before handing it over. No horizontal page scroll at any width; no text overflowing its box.
- Two-column layouts stack below ~800 px. Under 800 px the header collapses into a MENÚ toggle.

## Lists and tables

- Result lists and tables never scroll the page. The list fills the free height of the screen.
- Lists are paginated, not scrolled. Every paginated list, table or card grid has a "Mostrar" selector in its pager: the page size is the user's choice and never changes with the window size or the zoom. Tables offer 10, 25, 50 (10 by default); card grids offer whole rows of their columns. Exception: recommendations show a fixed 3 x 3 page (9 cards) with no selector. The pager stays visible while there are more items than the smallest size, even if the chosen size fits them in one page. When the chosen rows do not fit the screen, the list box scrolls inside (never the page); a table whose columns cannot fit on a phone may scroll sideways inside its own box.
- The pager sits at the bottom-right of the list, on the same row as the list's actions (for example CARGAR VEHÍCULO / IMPORTAR CSV on the left, pager on the right). Style: the pages are one segmented button group (‹ 1 2 3 … N ›) followed by "Mostrar [10]" at the right edge; numbers in secondary text, the current page in the table header tone (`--surface-raised`), never black.
- Row actions and the pager use the button group style (`components/buttonGroup.module.css`): white surface, thin border, thin dividers, soft shadow, radius 10, and a subtle hover in the table header tone. Row actions are separate buttons 8 px apart, ending at the cell padding of the table's right edge; an unavailable action stays as a greyed button so rows line up. Focus rings are soft (header tone), never a dark outline.
- Every data table (admin dealers, dealer inventory) uses the shared table styles (`components/dataTable.module.css`); a screen only sets its column widths, `--table-width` and which columns it drops on narrow screens. A row action that asks for confirmation (ELIMINAR) turns the rest of its row into the confirmation, so the table keeps its shape.
- Tables are only as wide as their fields need, with room to breathe (about 20 px of horizontal cell padding): fixed pixel column widths (`table-layout: fixed`, table width = sum of the columns), every row the same height, compact row actions (smaller than page buttons) on one line. The title, the table and the pager form a column centered on the page; the pager aligns with the table's right edge.
- The table box takes the free height of the screen and has no surface of its own (no background, border or shadow): the table itself carries the white rows and the rounded border, so it looks as tall as its rows. The pager stays pinned at the bottom of the screen. When the chosen rows do not fit, the box scrolls inside. Reserve the scrollbar lane (`scrollbar-gutter: stable`) so a vertical scrollbar never causes a sideways one. (Decided 2026-10-16 over a box sized by its rows, whose height and pager jumped with the row count.)
- On narrow screens a table drops its least needed columns (first contact, then place) instead of squeezing all of them; long cell text ends in an ellipsis with the full text in `title`.
- A search box for a list goes in the header row beside the title when there is room; on phones it drops under the title. Exception: recommendations follow Figma 38:168, with the search field full width under the header and no BUSCAR button (Enter searches).
- Recommendations show a 3 x 3 page (9 cards, fixed) in a centered column up to 1200 px. Moving between pages keeps the count ("Mostrando N vehículos") and the pager in place; only the cards are replaced by the loader. Cards are as tall as their content, with a 16:10 image; what does not fit scrolls inside the list box. Tablets show two columns, phones one card per row. (Decided 2026-10-16 over stretching two rows to fill the screen.)
- Scroll containers keep their rounded box: the frame clips, the inner region scrolls, slim inset scrollbar in the border color.

## Buttons

- The actions of a flow screen share one row in the pinned bottom bar; they stack only on phones.

- Every button uses the soft look (`components/button.module.css`): white surface, thin light border, soft shadow, dark grey label, subtle hover in the table header tone, soft focus ring, never a dark fill or a dark outline. The variant only changes the border and the label: primary a stronger border and bolder label, danger a red label, success a green label. Button-like controls (back chevrons, file pickers, photo remove) follow the same look.

## Feedback

- Message boxes (error, success, warning) have a tinted background and dark text: reuse `frontend/web/src/components/alert.module.css`.
- Loading is shown on the component that waits, never full screen: a submit button shows its busy state; a section that loads data shows a loader centered horizontally and vertically inside that section.
- Selections (checkbox, toggle, chip) change at once and save in the background: no loader, no blocking.
- Figma covers layout and business states only; loaders and service errors live in code and get no Figma frames.

## Platforms

- A screen decision applies to web and mobile by default; only layout that exists on one platform (desktop sidebar, bottom tab bar) stays on that platform.

## Catalog-backed inventory inputs (2026-10-24)

- User-approved manual-entry change: replace free make/model/version entry with
  searchable, dependent native catalog suggestions. An unmatched identity cannot
  be saved; both client and API validate selection. Keep existing field styling,
  photo panel and pinned action bar. Version is no longer labelled optional for
  new entries. Legacy edits retain their identity until explicitly relinked.
- Figma sync pending approval: High v3 create `2373:8756` and edit `2373:8835`
  still show text identity fields. Web implementation adds catalog/legacy notices;
  mobile receives the same identity rule when that form is implemented. No Figma
  changes or mobile implementation were performed here.

## HU05 matching-only recommendations (2026-10-20)

- Resale evidence (2026-10-22): reuse card2373:7340's existing warnings and expandable reasons for partial compatibility, the ten-point uncertainty deduction, DNRPA window and ACARA reference date. Missing priority is "no disponible", never zero. Preserve the existing layout. Applies to web and mobile; mobile implementation and Figma sync remain pending explicit approval. High v3 has no resale evidence copy; this extends the previously approved matching reasons, not the catalog controls.

- User-approved override: recommendations replace catalog search; no search field or catalog tab. HU07 adds the filters specified below. Backend order is retained, nine cards per page, up to ten results total.
- Cards show published/equivalent prices, compatibility, dealer, budget/body warnings and expandable grouped facts/motives. The shared quote shows source, sell rate, provider date and stale/unavailable notices. HU09 detail and HU08 comparison are described in their sections below.
- Figma sync pending approval: High v3 desktop `2373:7328`, mobile `2373:9914` still show search and placeholder match lines. Apply the matching-only/content changes to both; tablet follows web responsive rules. No Figma edits have been made.
- This supersedes the recommendation search-field rules above. Existing catalog components/tests remain unmounted legacy RF05 code, not another user-facing view.

## HU07 recommendation filters (2026-10-26)

- Refine only the complete top-ten set returned by profile matching, before pagination; never change scores, order, diagnosis or the API's candidate selection.
- High v3 desktop `2373:7641` / `2373:7662`: maximum ARS price, year from, maximum kilometers and transmission. Compare `price_ars` from the same response/quote shown on cards, including stale-quote behavior. Blank fields impose no restriction; bounds are inclusive; unknown values fail only their active criterion. Active criteria intersect.
- Draft fields take effect with APPLY, which collapses the panel and returns keyboard focus to its toggle; removing an applied chip or CLEAR takes effect immediately, resets drafts to the remaining applied values and returns to page one. Keep applied filters in the route query so navigation/back restores them; do not store buyer preferences globally.
- Empty filtered results retain controls/chips and a clear action, without suggesting a diagnosis change. Existing loading, failure and incomplete-diagnosis states remain intact.
- Keep size containment scoped to the HU07 page: the shared shell has a minimum height, not a fixed height. Opening the sidebar with applied chips must not push its footer below the viewport; the sidebar and results scroll internally.
- Figma sync approved on 2026-10-26, pending editing access: High v3 rejected writes in read-only mode; no canvas changes were applied. Follow-up is recorded on Trello card78. Retain the four controls but remove catalog search; show applied chips, ARS units, filtering of matching results and the dedicated empty state. Web uses a collapsible desktop sidebar and stacked mobile-width controls with internal scroll (at most 45dvh); native mobile remains pending HU07-MOBILE. Do not add HU09 detail or HU08 comparison screens in this story.

## HU09 dealer vehicle detail (2026-10-26)

- Follow High v3 desktop `2373:7348` and mobile `2373:9996`: gallery and grouped
  specifications on the left, price/dealer/actions and compatibility on the right;
  stack gallery, summary and specifications below 800px. Reuse the application shell.
- Expand Figma's one-line specification sample into general, engine/consumption,
  safety and comfort groups with plain-language explanations. Unknown is `No
  disponible`, distinct from explicit `No`. Missing/broken photos have fallbacks.
- User-approved follow-up: show those four groups as section tabs, with general
  information selected initially and the dealer description always below the
  tab panels. Reuse soft segmented controls, allow wrapping at narrow widths,
  and support arrow keys, Home/End and a single tab stop for the selected tab.
  Synchronized after passing tests to High v3 desktop `2373:7348` (card
  `2461:9166`) and mobile `2373:9996` (card `2461:9213`), with editable layers,
  general information shown initially, and vertically scrollable content.
  Native mobile implementation remains out of scope. Only the tab/description
  design is synchronized; unrelated pending synchronization below stays pending.
  No calculator-internal or API changes are part of the tab follow-up.
- `VER FICHA` is the primary recommendation-card action. `CALCULAR COSTOS`
  opens the teammate's HU10 route, now integrated in develop, from both the card
  and detail. Preserve HU10 internals. Connect the existing inspection; do not
  fake comparison/reventa.
- Compatibility is the recommendation-entry snapshot, never a substitute for
  current vehicle facts/availability. Direct entry does not invent a score.
- User-confirmed external acquisition retirement supersedes portal-origin detail
  assumptions; no original-publication action is shown for dealer inventory.
- Figma synchronization pending approval: expanded facts, unknown/unavailable
  states, restricted actions, compatibility provenance and filter-preserving back
  navigation. Semantics apply to both platform designs; native mobile HU09 remains
  unimplemented. No Figma writes or external thesis/test-source edits performed.

## HU08 vehicle comparison (2026-10-27)

- Follow High v3 desktop `2373:7368` / mobile `2373:10014`: two separate white vehicle cards with 14px corners, 32px gap, 160px photos and compact label/value rows. Each card is a named article with definition lists; CSS subgrid aligns corresponding rows even when values wrap. Keep both columns in a keyboard-focusable internal scroll viewport, never horizontal page scroll. Reuse the shell, back icon and explanation tooltips. Dynamic listing images retain explicit missing/broken fallbacks.
- Selection controls use scoped auto-width 32px buttons, wrapping only when needed; shared buttons elsewhere remain unchanged. Explanations and cost caveats remain available in a compact disclosure above the cards. Source, detailed facts, factors and costs extend the sparse reference without changing their calculations.
- Extend the sample with complete grouped technical facts, equipment, diagnosis compatibility factors and costs. Advantages mean compatibility reasons, not an absolute winner or promised satisfaction. Unknown is distinct from false. Preserve budget/body and missing/stale resale warnings.
- `/comparar?compare=<id>,<id>` requires two distinct current recommendations. Fetch live public details and the existing calculator GET with diagnostic/default inputs for each; never duplicate cost formulas, call ArgAutos or silently substitute zero on failure. Show ARS totals, partial/excluded costs, mileage, coverage and rates date; link to the full calculator.
- Figma synchronization pending explicit approval: selection/removal controls, exact-two/incomplete/replacement/error states, technical/equipment rows, diagnosis factors and calculator summaries are missing from both frames. Apply these design decisions to web and mobile; native mobile implementation stays out of scope. No Figma writes have been performed.
