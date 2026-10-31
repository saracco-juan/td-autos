# HU11 mobile favorites

Mobile RF10 uses the same authenticated favorites API as web. The heart on
recommendations and vehicle detail saves or removes the listing for the buyer.
It changes immediately, blocks repeated taps while saving and restores the
previous state with an inline error when the request fails. History is retired.

The Favorites tab lists saved vehicles independently from matching. Loading and
retryable errors stay inside the list. An empty list explains how to save vehicles;
VER RECOMENDADOS opens recommendations. Missing/broken photos have a fallback.
QUITAR removes a vehicle, and DESHACER restores the last successful removal.
Failed actions keep the persisted list and allow retry, including failed undo.
Lists offer 6/12/24 items, retain the size choice and return to the prior page if
removing its last item shrinks the page count. The pager and primary action stay
pinned while cards scroll. Revisiting Favorites loads current data locally.
If a heart save is still pending when opening Favorites, the list waits for it to
settle before loading, so it cannot report an empty list before the save completes.

## Manual check

Start the local backend and Expo as described in `getting-started.md`. Sign in
as a buyer, open recommendations and tap a vehicle's heart. Open its sheet:
the heart must still be selected. Remove it, reopen the sheet and check that
the heart is unselected. Stop the backend and tap again: the original selection
must return with an error; restart the backend and retry.

With seven or more saved vehicles, open Favoritos and move to page two. Choose
Mostrar 12 and Mostrar 24: the list returns to page one and keeps the selected
size. Remove the last vehicle on a page: the previous valid page must load.
QUITAR updates the count; DESHACER restores the last successful removal. If
restoring fails, the list remains removed and DESHACER stays available to retry.

Open VER FICHA from a saved card. Its selected heart and Volver a favoritos must
be present; that link returns to the refreshed saved list. A missing listing
still returns to Favoritos. Opening the sheet from Recomendados continues to
show Volver a recomendados. Check that the header, bottom tabs, pager and
VER RECOMENDADOS remain visible while the cards scroll on the phone.
