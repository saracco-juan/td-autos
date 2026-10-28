# Buyer favorites — HU11 / RF10

Favorites use the existing `favorito` table. Every operation requires an authenticated buyer and is scoped to that buyer; request data cannot select another owner.

`FavoritoController` handles validation, authorization and HTTP responses. `Services/Favorites/BuyerFavorites` owns all database queries, availability checks and persistence, following the controller/service boundary used by recommendations.

| API | Behavior |
| --- | --- |
| `GET /api/favoritos` | Current public facts for saved, available dealer vehicles; newest saved first, vehicle ID descending breaks ties. |
| `PUT /api/favoritos/{id}` | Save an available listing, returning 204. Repeating it preserves the original save date. |
| `DELETE /api/favoritos/{id}` | Remove this buyer's favorite, returning 204 even when already absent. Withdrawn listings can be removed. |

The list accepts `page` (positive integer), `per_page` (1–60, default 6), and optional `ids[]` (1–60 positive vehicle IDs). The latter reads saved status for the visible recommendation cards or detail without downloading all favorites. Responses contain `data` and pagination `meta`; private ownership fields are never exposed. Reads are private and uncached. Favorites do not require a diagnosis or invoke the calculator, exchange-rate provider or recommendation ranking.

TC-31 covers saving, TC-32 removal, and the favorites portion of TC-34 the empty state. On 2026-10-28 the user explicitly excluded the obsolete search history scope (TC-33 and the history portion of TC-34).
