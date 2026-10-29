# Dealership WhatsApp contact (HU25)

RF29 / TC65 opens WhatsApp for the selected listing. RF30 / TC66 records the
buyer's lead when the contact is requested, regardless of sending the message.

Each dealership uses its existing `telefono_publico`; there is no environment
allowlist and no additional phone field or schema migration. The dealership
owner can edit or clear it in Verificación → EDITAR CONTACTO under CONTACTO DE LA CONCESIONARIA.
The existing administrator editor and dealership registration still use that
same public phone. Enter an international number that uses WhatsApp; the system
validates syntax but does not check whether WhatsApp has registered the number.

`GET /api/concesionaria/contacto` returns the authenticated owner's public phone.
`PUT` accepts `{ "telefono_publico": "+54 9 11 ..." }`, normalizes spaces,
parentheses, plus and hyphens, and saves 8–15 digits or null for an empty field.
Both routes require the existing dealer middleware and resolve ownership from
the session, never a client-supplied dealership ID. Pending dealerships can
maintain their contact details; buyer contact still requires an operative listing.
Clearing the public phone disables WhatsApp contact. Changes apply immediately.
Existing DEALER_WHATSAPP_NUMBERS environment entries can be removed; they are ignored.
Personal test numbers belong only in local data, never source or fixtures.

The authenticated buyer calls `POST /api/vehiculos/{id}/contacto` with
`{ "attempt_id": "<UUID>" }`. The web keeps that UUID after an uncertain response
and reuses it on retry; a successful contact clears it for the next attempt.
The field is optional for older clients, which retain their per-request behavior.
The service atomically records an opaque, buyer-and-vehicle-scoped attempt marker
in the existing database `cache` table together with the lead. Retries with the
same marker do not insert another lead; authorization and availability are still
checked. No message facts are cached. Clearing that table removes retry protection.
The service checks the current listing and subscription, inserts a lead, and
returns HTTP 201 with `{ "url": "https://wa.me/…?text=…" }`. The message uses the
stored full name, vehicle identity, known mileage and plate. Missing facts are
omitted. The existing detail response only adds `whatsapp_available`; it still
does not expose the plate or phone. Failed writes never open WhatsApp.

The web button navigates in the same tab after persistence, so popup blocking
cannot prevent the handoff. WhatsApp supplies the final editable message; only
the user sends it. No delivery callback or automatic retry is needed.

Manual check: start backend and web per `getting-started.md`, sign in as a
dealership and open Verificación → EDITAR CONTACTO. Edit and save its public WhatsApp phone, then reload
to check persistence. As buyer, open a vehicle belonging to that dealership and
click CONTACTAR POR WHATSAPP. Check recipient and message facts; the lead must
exist even without sending. Clear the phone as the dealership and reload the
buyer ficha: it must show WhatsApp no disponible. Another dealership's number
must remain unchanged; buyers and administrators cannot use the owner endpoint.
