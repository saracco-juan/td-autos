# Dealership subscription workspace

The dealership subscription page combines the account overview with its saved
payment receipts. REALIZAR TRANSFERENCIA opens bank details and receipt upload in
a modal. A pending receipt prevents a second submission; active subscriptions
can renew before expiry. Approval and rejection remain administrator decisions.

Account state and expiry live in Subscription. The redundant Verification menu
entry, receipt overview and review card are removed. The legacy `/concesionaria`
entry redirects to Subscription; contact editing placement remains deferred.

## Private receipt history

These routes use the existing authenticated `dealer` middleware, including for
pending or inactive dealerships:

| Request | Result |
| --- | --- |
| `GET /api/concesionaria/suscripcion/comprobantes` | Newest-first JSON array of the signed-in dealership's receipts. |
| `GET /api/concesionaria/suscripcion/comprobantes/{id}/archivo` | Streams that dealership's private receipt file. |

Each history entry contains `id`, `nombre_archivo`, `periodo_desde`,
`periodo_hasta`, nullable `enviado_en`, `estado`, nullable `fecha_revision`, and
nullable `motivo_rechazo`. Storage paths and administrator identity are not
exposed. Guest requests receive 401; non-dealership accounts receive 403;
another dealership's, unknown, or missing files receive 404. The existing
subscription summary and receipt submission response keep their JSON shape.

The web client paginates the array with the existing page-size choices. Both
recommendations and receipt history use `ResultsPagination`; history uses the
shared `ScrollArea` in fill mode. Downloads use the authenticated blob client
and release temporary URLs when the row unmounts or another download begins.
VER reuses the same private endpoint to preview JPG/PNG images or PDFs in the
shared dialog. Closing the preview releases its temporary URL. No public file
links or additional backend endpoints are introduced.

## Manual verification

Start the backend and web app as described in [getting-started.md](getting-started.md),
then sign in as a dealership and open Suscripción:

1. Verify that the overview matches its account state and receipt history.
2. Change the history page and page size. Preview and download an owned receipt;
   close the preview with CERRAR or Escape and confirm focus returns to VER.
3. Open REALIZAR TRANSFERENCIA. Confirm that bank details and upload share the modal.
4. Select a valid PDF/JPG/PNG up to 5 MB; close and reopen the modal. The selection remains.
5. Submit only in a disposable environment. The receipt becomes pending, history
   refreshes and a second submission is unavailable until review.
6. With keyboard input, check Tab containment, Escape and focus restoration.
   Check a narrow viewport and reduced motion separately.

Bank details must be configured on the backend. Missing configuration explains
the administrative action needed and disables submission. Local DEMO receipts
and process-only payment settings are test fixtures, not deployable bank data.
