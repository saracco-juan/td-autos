# Buyer favorites — HU11 / RF10

Favorites use the existing `favorito` table. Every operation requires an authenticated buyer and is scoped to that buyer; request data cannot select another owner.

`FavoritoController` handles validation, authorization and HTTP responses. `Services/Favorites/BuyerFavorites` owns all database queries, availability checks and persistence, following the controller/service boundary used by recommendations.

| API | Behavior |
| --- | --- |
| `GET /api/favoritos` | Current public facts for saved, available dealer vehicles; newest saved first, vehicle ID descending breaks ties. |
| `PUT /api/favoritos/{id}` | Save an available listing, returning 204. Repeating it preserves the original save date. |
| `DELETE /api/favoritos/{id}` | Remove this buyer's favorite, returning 204 even when already absent. Withdrawn listings can be removed. |

The list accepts `page` (positive integer), `per_page` (1–60, default 6), and optional `ids[]` (1–60 positive vehicle IDs). Responses contain `data` and pagination `meta`; private ownership fields are never exposed. Reads are private and uncached. This API does not require a diagnosis or invoke the calculator, exchange-rate provider or recommendation ranking.

Recommendations and detail include the authenticated buyer's `is_favorite` status. Recommendations use one batched service lookup; the shared web `FavoriteButton` needs no separate status request. It updates immediately, prevents overlapping toggles for its vehicle and restores the previous state on failure.

The standalone `/favoritos` screen lists current saved vehicles, with 6/12/24 items per page, removal and Deshacer. Failed actions retain their original intent when retried. Only the latest page request updates the list; deleting the last item on a page returns to an existing page. The screen separately requests existing recommendations for optional compatibility and the actual top-match badge. A missing diagnosis or failed matching request never blocks the saved list. Unknown facts are unavailable, never zero.

## Manual check

Start the API and web using [getting started](getting-started.md), then sign in as a test buyer.

1. Save one recommended vehicle with its heart; save another from its detail. Both appear in Favoritos after reloading.
2. Open VER FICHA from Favoritos. Its heart remains selected and Volver a favoritos returns to the list.
3. Use QUITAR, then Deshacer. The vehicle disappears, returns, and remains saved after reloading.
4. Remove the remaining test favorites. The empty state offers VER RECOMENDADOS.
5. With more than six saved vehicles, change Mostrar and pages. The list scrolls internally at desktop, tablet and phone widths; deleting a page's last vehicle returns to a valid page.

TC-31 covers saving, TC-32 removal, and the favorites portion of TC-34 the empty state. On 2026-10-28 the user explicitly excluded the obsolete search history scope (TC-33 and the history portion of TC-34).
