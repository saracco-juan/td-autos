# Dealership WhatsApp contact (HU25)

RF29 / TC65 opens WhatsApp for the selected listing. RF30 / TC66 records the
buyer's lead when the contact is requested, regardless of sending the message.

No schema change is required. Edit the existing public phone from the admin
dealer form and confirm separately that the number uses WhatsApp. Configure
`DEALER_WHATSAPP_NUMBERS` with the confirmed international numbers (8–15 digits,
no punctuation, comma-separated). Empty configuration disables all contacts.
The service normalizes spaces, parentheses, plus and hyphen from the public
phone, then requires an exact match in that list. A phone alone is never proof
of a WhatsApp account. Restart the local backend after changing environment
configuration; refresh Laravel's configuration cache where it is used.

Removing a number from the list disables contact for it without changing the
public phone. No WhatsApp account lookup or messaging API is involved.

Personal test numbers belong only in local demo data, never source or fixtures.
Use a disposable SQLite copy and explicit connection settings for manual tests;
do not rebuild an existing database with `db:local`.

The authenticated buyer calls `POST /api/vehiculos/{id}/contacto` with no body.
The service checks the current listing and subscription, inserts a lead, and
returns HTTP 201 with `{ "url": "https://wa.me/…?text=…" }`. The message uses the
stored full name, vehicle identity, known mileage and plate. Missing facts are
omitted. The existing detail response only adds `whatsapp_available`; it still
does not expose the plate or phone. Failed writes never open WhatsApp.

The web button navigates in the same tab after persistence, so popup blocking
cannot prevent the handoff. WhatsApp supplies the final editable message; only
the user sends it. No delivery callback or automatic retry is needed.

Manual check: start backend and web per `getting-started.md`, configure a demo
dealer's public phone and confirm it in the local environment, sign in as buyer, open its vehicle and click
CONTACTAR POR WHATSAPP. Check recipient and all message facts. Close WhatsApp
without sending: the lead must already exist. Remove the number from the confirmation list and
reload the ficha: it must show WhatsApp no disponible.
