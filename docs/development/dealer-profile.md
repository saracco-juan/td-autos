# Dealership owner profile

`GET /api/concesionaria/perfil` returns the authenticated dealership's profile. `PUT` saves the editable fields and returns the same shape. Both routes require the existing authenticated dealer middleware; pending dealerships can also use them.

| Fields | Owner access |
| --- | --- |
| `nombre`, `email` | Read-only; attempts to submit nonempty values return 422. |
| `telefono_publico`, `direccion`, `localidad`, `provincia` | Editable dealership contact and location. |
| `responsable_nombre`, `responsable_apellido`, `responsable_dni`, `telefono_responsable` | Editable responsible person's details. |

The server derives ownership from the session, never from submitted IDs. It updates only the listed editable fields, saving the dealership and responsible person's names in one transaction. Roles, credentials, approval state and other dealerships remain unchanged.

Public WhatsApp uses the same normalization and validation as `/api/concesionaria/contacto`: country code, 8–15 digits, optional spaces/parentheses/plus/hyphens; an empty value disables public contact. The responsible person's phone is separate. Other fields retain the registration/admin text limits. Validation failures return 422 with field errors and leave saved data unchanged.

## Verification

The web dashboard exposes this form at `/concesionaria/perfil` for active and pending dealerships. It reuses shared form controls and the pinned action bar, retains edits after failure, and confirms navigation while changes are unsaved. Name and email remain selectable read-only inputs. Save feedback resets the dirty state; Discard restores the last saved values without a request.

For a manual smoke test, start Laravel and Vite as described in `docs/getting-started.md`, sign in as a dealership, and open Perfil. Change the location or responsible person, save, and reload: the values must persist. Edit again and select another tab: cancel keeps the edits, while leaving discards them. Name/email cannot be changed. An empty public WhatsApp disables that contact channel.

From `frontend/web`, run `npm run test -- src/test/features/dealer/DealerProfilePage.test.tsx src/test/app/AppShell.test.tsx src/test/app/router.test.tsx`.

From `backend`, run `php artisan test --filter='DealerProfileTest|DealerContactSettingsTest|AdminDealerDetailTest'`. Tests use isolated in-memory SQLite, covering ownership, pending access, immutable identity, validation, persisted edits and optional public contact. No schema migration or real data reset is required.
