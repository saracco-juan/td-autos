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
| [`frontend/mobile/`](frontend/mobile) | App móvil | React Native, Expo, TypeScript |

## Inicio rápido

### Requisitos

- PHP 8.2+ y Composer
- Node.js 22.13+ (o 24.3+) y npm: lo exige Expo para la app móvil

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

Para probar sin Supabase, `php artisan db:local` arma desde cero `backend/database/manual.sqlite` (migraciones y datos de demo). **Borra el archivo de destino si ya existe**: para conservar una base anterior, usar `php artisan db:local --path=<ruta absoluta de un archivo nuevo>`. Nunca toca la conexión del `.env` y no corre en producción. Crea un administrador, un comprador, 7 concesionarias en todos los estados con sus comprobantes y 2 vehículos deterministas para cada concesionaria activa: Chevrolet Onix LT y Toyota Corolla XEi, con carrocería y valores válidos para edición. Cada vehículo tiene siete imágenes sintéticas locales de su modelo; no representan ofertas reales. El comando guarda imágenes en el disco `public` y comprobantes en `local`, sin usar almacenamiento remoto. Para usar la nueva base, en `.env`:

```env
DB_CONNECTION=sqlite
DB_DATABASE=<ruta absoluta de backend/database/manual.sqlite>
DB_URL=
APP_URL=http://localhost:8000
VEHICLE_PHOTOS_DISK=public
RECEIPTS_DISK=local
```

Ejecutar `php artisan storage:link` para servir las fotos locales. Para el frontend de Vite, usar `FRONTEND_URL=http://localhost:5173`. Las concesionarias activas de demo son `pampa` y `litoral`: entrar con una de ellas, abrir Inventario, editar un vehículo, comprobar sus siete fotos y guardar un precio distinto. Al volver a abrirlo deben conservarse el precio y las fotos. Un vehículo histórico sin carrocería debe abrir con la selección vacía y exigir completarla antes de guardar. HU05 continúa pendiente.

Cuentas de demo (contraseña `TdAutos2026!`): `admin@demo.tdautos.test`, `comprador@demo.tdautos.test` y las concesionarias `sur`, `rosario`, `cuyo`, `norte`, `capital`, `pampa` y `litoral` con el sufijo `@demo.tdautos.test`.

Para probar con volumen, `php artisan db:local --vehiculos=10000` suma a esa base unas 50 concesionarias activas con suscripción vigente (`concesionaria01@volumen.tdautos.test` a `concesionaria50@volumen.tdautos.test`, misma contraseña) y reparte entre ellas la cantidad de vehículos pedida, de forma desigual y siempre con los mismos datos: modelos y carrocerías reales del mercado argentino, precios y kilometrajes acordes al año, patentes únicas y 7 fotos por vehículo. Las fotos son 7 imágenes numeradas que se escriben en el disco `public` (`backend/storage/app/public/vehiculos/volumen`); corré `php artisan storage:link` una vez para que se vean. Sin la opción, la base queda como antes. Es solo para SQLite local: no sirve para Supabase.

### 2. Frontend web

```bash
cd frontend/web
npm install
npm run dev
```

### 3. App móvil

```bash
cd frontend/mobile
npm install
cp .env.example .env
```

El celular no alcanza el `localhost` de la PC: en `.env` poné en `EXPO_PUBLIC_API_URL` la IP de la PC en la red local (por ejemplo `http://192.168.0.10:8000`) y levantá el backend con `php artisan serve --host=0.0.0.0`. Después:

```bash
npx expo start
```

Abrí la app con Expo Go escaneando el QR. El celular y la PC tienen que estar en la misma red Wi-Fi.

La app usa tokens de Sanctum (`/api/mobile/*`), no la cookie de sesión de la web, y solo admite compradores. El link del mail de recuperación abre la pantalla web de restablecimiento.

**Google desde el celular.** Al terminar, el backend vuelve a la app con un código de un solo uso. Solo acepta direcciones de retorno que empiecen con los prefijos de `MOBILE_REDIRECT_PREFIXES` (por defecto `tdautos://`); fuera de producción también acepta `exp://`, que es lo que usa Expo Go. Google no acepta una IP de la red local como URI de redirección, así que para probarlo en el celular hace falta exponer el backend con un túnel HTTPS (por ejemplo `cloudflared tunnel --url http://localhost:8000`). Con el túnel podés probar la web en la PC y la app en el celular al mismo tiempo:

- `APP_URL` y `GOOGLE_REDIRECT_URI` siguen en `localhost`: los usa la web.
- La app usa `GOOGLE_MOBILE_REDIRECT_URI=<url del túnel>/auth/google/callback` (si no la definís, cae en `GOOGLE_REDIRECT_URI`). Registrá las dos URIs de callback en Google Cloud.
- Dejá `SESSION_DOMAIN` vacío, así la cookie de sesión también funciona en el host del túnel.
- En `EXPO_PUBLIC_API_URL` poné la URL del túnel.
- La URL del túnel rápido cambia cada vez que lo levantás: actualizá `GOOGLE_MOBILE_REDIRECT_URI` y volvé a registrarla en Google Cloud.

## Comandos útiles

| Parte | Tests | Lint / formato | Build |
|-------|-------|----------------|-------|
| Backend | `php artisan test` | `./vendor/bin/pint` | — |
| Frontend web | `npm run test` (con cobertura: `npm run test:coverage`) | `npm run lint` | `npm run build` |
| App móvil | `npm run test` (con cobertura: `npm run test:coverage`) | `npm run lint` y `npm run typecheck` | `npx expo export --platform android` |

## Integración continua

El workflow [`.github/workflows/ci.yml`](.github/workflows/ci.yml) corre en cada push y pull request hacia `develop` y `main`:

| Job | Qué verifica |
|-----|--------------|
| Backend | `./vendor/bin/pint --test` y `php artisan test` con cobertura |
| Frontend web | `npm run lint`, `npm run test:coverage` y `npm run build` |
| App móvil | `npm run lint`, `npm run typecheck`, `npm run test:coverage` y `npx expo export --platform android` |
| SonarQube Cloud | Análisis estático y cobertura de los tres proyectos, configurado en [`sonar-project.properties`](sonar-project.properties) |

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
