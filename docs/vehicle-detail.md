# Buyer vehicle detail (HU09)

`GET /api/vehiculos/{id}` returns `{vehicle, dealer}` to authenticated buyers.
It does not require a diagnosis, create records, fetch external providers or expose
plates, ownership records or private dealer contacts. Photos retain upload order;
missing facts remain `null` and missing photos are an empty array.

Only visible dealer inventory with an approved, operative dealer is available.
Subscription validity includes the existing three-day grace period. Hidden,
missing, unowned, external or non-operative listings return `404` with
`Esta publicación ya no está disponible.` Success and unavailable responses use
`Cache-Control: private, no-store`. Guests receive `401`; non-buyers receive `403`.

## Scope and pending dependencies

- TC-26 covers complete detail; TC-27 is adapted to incomplete **dealer** facts.
  The user confirmed that external acquisition is retired. Its replacement is
  undecided; the external-origin wording in the thesis/test sources needs later
  correction. Historical external records remain untouched.
- TC-77 requires fresh availability checks, not previously cached detail.
- HU10 calculator logic/routes belong to the teammate. This endpoint does not
  implement or alter them. No comparison or depreciation flow is introduced.

## Check the API

Run `php artisan test --filter=BuyerVehicleDetailTest` in `backend/`.
The tests use in-memory SQLite, forbid provider acquisition and cover full and
incomplete detail, withdrawal, subscription/approval boundaries, private-field
exclusion, authentication and excluded external records.
