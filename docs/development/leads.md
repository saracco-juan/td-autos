# Dealership lead indicator (HU26 / RF31)

Open **Métricas** from the dealership navigation to see contact requests for this
week, this month (default), or all recorded history. The total and descending
vehicle ranking use the same period. Vehicles without contacts remain at zero;
a period with no contacts shows the TC-68 empty state.

## Counting rules

A lead is recorded when a buyer requests the WhatsApp contact link (HU25),
before any message is sent. It is not a unique buyer, confirmed conversation,
sale or financial ROI. Existing retry deduplication remains unchanged.

Calendar weeks start on Monday; week and month start at midnight in the backend
application timezone (UTC). Counts include contacts through the current instant.
Hidden vehicles remain in the ranking. Permanent vehicle deletion already
removes its leads; this feature does not change data retention.

## API and checks

`GET /api/concesionaria/leads?period=month` requires the signed-in dealer session.
`period` accepts `week`, `month` or `all`; invalid values return 422. The dealer
is resolved from the session, never from query parameters. The response contains
`period`, `total`, and `vehicles` (`id`, `label`, `leads`, optional `brand` metadata), ordered by count then ID.
The shared summary derives contacted-vehicle coverage, contacts by brand and the
share of contacts in the top three vehicles. Zero denominators return zero.
The brand chart groups brands beyond the top five into Otras when there are
more than six brands; this preserves the total without overcrowding the chart.

Run `php artisan test tests/Feature/Concesionaria/DealerLeadsTest.php` in `backend`.
It covers TC-67/68, period boundaries, hidden and zero-contact vehicles, future
timestamps, ownership isolation and access validation without changing lead data.

Screen differences from High v3 `2373:8805` are recorded in `docs/design.md`.
Figma synchronization waits for the user's explicit acceptance of the screen.
