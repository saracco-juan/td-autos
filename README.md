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

Para probar con volumen, `php artisan db:local --vehiculos=10000` suma a esa base unas 50 concesionarias activas con suscripción vigente (`concesionaria01@volumen.tdautos.test` a `concesionaria50@volumen.tdautos.test`, misma contraseña) y reparte entre ellas la cantidad de vehículos pedida, de forma desigual y siempre con los mismos datos: modelos y carrocerías reales del mercado argentino, precios y kilometrajes acordes al año, patentes únicas y 7 fotos por vehículo. Las fotos son 7 imágenes numeradas que se escriben en el disco `public` (`backend/storage/app/public/vehiculos/volumen`); corré `php artisan storage:link` una vez para que se vean. Sin la opción, la base queda como antes. Es solo para SQLite local: no sirve para Supabase.

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
