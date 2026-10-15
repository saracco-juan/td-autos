# TD Autos

[![Quality gate status](https://sonarcloud.io/api/project_badges/measure?project=saracco-juan_td-autos&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=saracco-juan_td-autos)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=saracco-juan_td-autos&metric=coverage)](https://sonarcloud.io/summary/new_code?id=saracco-juan_td-autos)

Portal web de recomendación de autos usados y gestión de concesionarias. Proyecto de tesis.

El usuario obtiene recomendaciones de vehículos según su perfil; las concesionarias publican y gestionan su stock (inspecciones, transferencias, publicaciones externas y leads).

## Estructura del repositorio

| Carpeta | Qué contiene | Stack |
|---------|--------------|-------|
| [`backend/`](backend) | API REST y modelo de datos | PHP 8.2, Laravel 12, Sanctum, Supabase (PostgreSQL) |
| [`frontend/web/`](frontend/web) | Aplicación web (SPA) | React 19, TypeScript, Vite |
| `frontend/mobile/` | App móvil | React Native |

## Inicio rápido

### Requisitos

- PHP 8.2+ y Composer
- Node.js 20+ y npm

### 1. Backend

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
php artisan serve
```

La base de datos es Supabase (PostgreSQL). Antes de migrar, completar en `.env` `DB_CONNECTION=pgsql` y `DB_URL` con la cadena de conexión del proyecto de Supabase.

#### Base de datos local

Para probar sin Supabase, `php artisan db:local` arma desde cero `backend/database/manual.sqlite` (migraciones y datos de demo). Nunca toca la conexión del `.env` y no corre en producción; se puede volver a ejecutar para recrearla. Crea un administrador, un comprador, 7 concesionarias en todos los estados con sus comprobantes y 2 vehículos para cada concesionaria activa (las fotos son solo rutas, sin archivos). Para usarla, en `.env`:

```env
DB_CONNECTION=sqlite
DB_DATABASE=<ruta absoluta de backend/database/manual.sqlite>
```

Cuentas de demo (contraseña `TdAutos2026!`): `admin@demo.tdautos.test`, `comprador@demo.tdautos.test` y las concesionarias `sur`, `rosario`, `cuyo`, `norte`, `capital`, `pampa` y `litoral` con el sufijo `@demo.tdautos.test`.

### 2. Frontend web

```bash
cd frontend/web
npm install
npm run dev
```

## Comandos útiles

| Parte | Tests | Lint / formato | Build |
|-------|-------|----------------|-------|
| Backend | `php artisan test` | `./vendor/bin/pint` | — |
| Frontend web | `npm run test` (con cobertura: `npm run test:coverage`) | `npm run lint` | `npm run build` |

## Diagnóstico manual de Mercado Libre (HU06 / RF05)

Este diagnóstico comprueba autenticación y acceso a publicaciones de vehículos, todavía no
implementa el servicio de búsqueda productivo ni el matching. No guarda tokens ni publicaciones.
Con las dependencias del backend instaladas, ejecutá en una terminal privada e interactiva:

```powershell
cd backend
php artisan mercadolibre:probe-access
```

No necesitás iniciar Laravel, el frontend ni un túnel para este diagnóstico manual.

1. Ingresá el **App ID** y **Client secret** cuando se pidan: la entrada queda oculta.
   No los pases como argumentos ni los pegues en el chat. El App ID sí aparece en la URL pública.
2. Abrí personalmente la URL generada y autorizá tu app. Conservá habilitado PKCE.
   El redirect usado en autorización e intercambio es exactamente
   `https://brought-clover-landmass.ngrok-free.dev`, sin barra final: corresponde solo a la app
   de desarrollo actualmente registrada; no es una configuración para otras apps.
3. Dentro de cinco minutos, copiá la URL final completa del navegador y pegala en el prompt
   oculto. Debe contener `code` y `state`. El dominio puede mostrar `ERR_NGROK_3200` y conservar
   esos parámetros en la barra: el error por sí solo **no demuestra autorización**. El comando
   no levanta un callback ni un servidor. Si faltan los parámetros, no hubo una captura válida.
4. Revisá el JSON sanitizado. Se intercambia el código una sola vez y se consulta `/users/me`
   y `/sites/MLA/search` con el mismo token, `q=Toyota Corolla`, `category=MLA1744`, `limit=5`,
   sin seleccionar vendedor. No se reintenta automáticamente ni se sigue ninguna redirección.

| Resultado | Qué demuestra / siguiente paso |
| --- | --- |
| `listings_received`, `result_count > 0` | Recibimos publicaciones. Abrí sus URLs originales y comprobá que sean autos activos, de otros vendedores y que correspondan a los criterios. No prueba por sí solo el matching ni todos los filtros. |
| `empty_results` | La consulta respondió con una lista vacía; todavía no demuestra acceso a publicaciones reales. |
| Cuenta 200 y búsqueda 403 / `search_rejected` | Autenticación válida no implica permiso de búsqueda global. Conservá el diagnóstico sanitizado; la causa del rechazo sigue sin demostrarse. |
| `malformed_*`, `connection_error` u otro error | No se confirmó una respuesta válida. La salida es no cero; iniciá un intento nuevo si corresponde, nunca reutilices el código. |

No se imprimen el perfil, respuestas crudas, código OAuth, secretos ni tokens. El proceso descarta
el token al terminar; una nueva ejecución requiere nueva autorización. No uses grabación de
terminal ni compartas la URL OAuth/callback. La renovación automática queda fuera de este incremento.

#### Comparar el rechazo con y sin categoría

Desde `backend`, repetí el flujo de autorización manual con un intento nuevo (el token anterior
se descartó al salir). No necesitás iniciar servidores ni túneles:

```powershell
php artisan mercadolibre:probe-access --compare-category
```

El JSON conserva **A: `search`**, con `category=MLA1744`, y agrega **B: `search_without_category`**:
misma URL, token, `q` y `limit`, quitando únicamente `category`, incluso si A falla.
Cada resultado incluye `status`/`format` y, si el proveedor los envía, `provider_error` con
`error`, `code`, `blocked_by`, `status`, `message` y `cause` acotados y redactados.
A403/B403 confirma ambos rechazos; A403/B200 muestra una diferencia, **no demuestra su causa
ni acceso a autos**. B no convierte el `ok: false` de A en éxito. A200/B403 conserva el resultado
de A; revisá B por separado. `results_received_unclassified` en B solo cuenta publicaciones,
sin afirmar que sean vehículos; `empty_results` no prueba recuperación real. Un timeout queda
como `status: null`/`connection_error`, sin reintento ni pérdida del otro resultado.
Compartí únicamente el JSON sanitizado, nunca credenciales, URL de autorización o callback.
Si ambos siguen devolviendo un 403 genérico, consultá la
[guía oficial de errores 403](https://developers.mercadolibre.com.ar/es_ar/error-403): hay varias
causas posibles y este diagnóstico no habilita permisos ni sustituye la búsqueda por inventario de un vendedor.

Tests sin acceso real: `php artisan test --filter MercadoLibreAccessProbe` desde `backend`.
Referencias: [OAuth oficial](https://developers.mercadolibre.com.ar/es_ar/sobre-nuestra-api/autenticacion-y-autorizacion)
y [búsquedas oficiales](https://developers.mercadolibre.com.ar/es_ar/api-docs-es/items-y-busquedas).

## Integración continua

El workflow [`.github/workflows/ci.yml`](.github/workflows/ci.yml) corre en cada push y pull request hacia `develop` y `main`:

| Job | Qué verifica |
|-----|--------------|
| Backend | `./vendor/bin/pint --test` y `php artisan test` con cobertura |
| Frontend web | `npm run lint`, `npm run test:coverage` y `npm run build` |
| SonarQube Cloud | Análisis estático y cobertura de ambas partes, configurado en [`sonar-project.properties`](sonar-project.properties) |

El job de SonarQube Cloud necesita el secret `SONAR_TOKEN` en el repositorio de GitHub y no corre en pull requests abiertos desde forks.

## Convenciones

### Ramas

- Una rama por historia de usuario (UH), creada desde `develop`: `feature/uh-<número>-<descripcion-corta>`.
  - Ejemplo: `feature/uh-12-registro-usuario`.
- Correcciones urgentes sobre `main`: `hotfix/<descripcion-corta>`.
- Cada rama se integra a `develop` mediante un pull request.

### Commits

Se usa [Conventional Commits](https://www.conventionalcommits.org/):

```text
<tipo>(<alcance>): <descripción>

[cuerpo opcional]

[footer opcional]
```

| Tipo | Cuándo usarlo |
|------|---------------|
| `feat` | Nueva funcionalidad |
| `fix` | Corrección de un error |
| `docs` | Solo documentación |
| `style` | Formato o estilos, sin cambiar lógica |
| `refactor` | Cambio de código que no agrega funcionalidad ni corrige errores |
| `test` | Agregar o corregir tests |
| `chore` | Mantenimiento: dependencias, configuración, tooling |
| `build` | Sistema de build o dependencias externas |
| `ci` | Integración continua |
| `perf` | Mejora de rendimiento |
| `revert` | Revierte un commit anterior |

| Alcance | Parte del proyecto |
|---------|--------------------|
| `api` | Backend |
| `db` | Migraciones y modelo de datos |
| `web` | Frontend web |
| `mobile` | App móvil |

Reglas:

- Descripción en imperativo, minúscula inicial, sin punto final y de hasta 72 caracteres.
- Un commit = un cambio coherente, con sus tests.
- Referenciar la UH en el footer: `Refs: UH-12`.
- Cambios incompatibles: `!` después del tipo (`feat(api)!: ...`) y footer `BREAKING CHANGE: <detalle>`.

Ejemplos:

```text
feat(web): add registration form
fix(api): reject duplicated email on register
test(api): cover password reset flow
docs: add project README
```
