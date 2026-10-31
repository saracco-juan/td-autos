# HU11 mobile favorites

Mobile RF10 uses the same authenticated favorites API as web. The heart on
recommendations and vehicle detail saves or removes the listing for the buyer.
It changes immediately, blocks repeated taps while saving and restores the
previous state with an inline error when the request fails. History is retired.

## Manual check

Start the local backend and Expo as described in `getting-started.md`. Sign in
as a buyer, open recommendations and tap a vehicle's heart. Open its sheet:
the heart must still be selected. Remove it, reopen the sheet and check that
the heart is unselected. Stop the backend and tap again: the original selection
must return with an error; restart the backend and retry.
