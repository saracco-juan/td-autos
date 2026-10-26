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

## Comprehensible specifications

The new specification component groups general facts, engine/consumption, safety,
comfort and dealer description. Unknown facts say `No disponible`; explicit
equipment absence says `No`, never inferred from missing data. Numeric zero is
retained. Consumption uses liters per 100 km only for compatible fuel types; other
values disclose that their unit was not provided. Descriptions remain plain text.
Pure detail types and explanations live in `frontend/shared/vehicles/detail.ts`
for reuse by native mobile. The existing inventory equipment labels are reused.

The gallery uses the ordered API photos, with a full-size image and keyboard
accessible thumbnail buttons. Missing or failed images have explicit fallbacks;
one failed photo does not prevent selecting the remaining ones. It never requests
stock or placeholder images and does not modify uploaded files.

## Open the detail screen

Start backend and web as described in `getting-started.md`, sign in as a buyer,
and open `/vehiculos/<id>` for a currently visible dealer vehicle. Expect its
gallery, public facts, price, dealer and working inspection link. Unknown data
has explicit notices. A hidden/missing listing shows unavailable without facts;
network/server errors offer retry. Changing IDs clears the previous detail.

The calculator control is visibly unavailable until the teammate integrates
HU10; there is no dead costs link and no calculator implementation here.

`VER FICHA` is the primary recommendation-card action. Its history state carries
only the displayed compatibility factors and the local recommendations/filter URL.
The detail always fetches current vehicle facts; recommendation context never
replaces an unavailable response. Compatibility is labelled as the entry snapshot,
not a new calculation. Direct entry does not invent a profile match. Invalid or
mismatched context is ignored. The back link restores applied filters.
