# HU11 mobile favorites

Mobile RF10 uses the same authenticated favorites API as web. The heart on
recommendations and vehicle detail saves or removes the listing for the buyer.
It changes immediately, blocks repeated taps while saving and restores the
previous state with an inline error when the request fails. History is retired.

The Favorites tab lists saved vehicles independently from matching. Loading and
retryable errors stay inside the list. An empty list explains how to save vehicles;
VER RECOMENDADOS opens recommendations. Missing/broken photos have a fallback.
This read-only list work unit precedes list removal, undo and pagination controls.
If a heart save is still pending when opening Favorites, the list waits for it to
settle before loading, so it cannot report an empty list before the save completes.

## Manual check

Start the local backend and Expo as described in `getting-started.md`. Sign in
as a buyer, open recommendations and tap a vehicle's heart. Open its sheet:
the heart must still be selected. Remove it, reopen the sheet and check that
the heart is unselected. Stop the backend and tap again: the original selection
must return with an error; restart the backend and retry.
