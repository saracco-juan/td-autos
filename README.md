# TD Autos

Portal web de recomendación de autos usados y gestión de concesionarias. Proyecto de tesis.

El usuario obtiene recomendaciones de vehículos según su perfil; las concesionarias publican y gestionan su stock (inspecciones, transferencias, publicaciones externas y leads).

## Estructura del repositorio

| Carpeta | Qué contiene | Stack |
|---------|--------------|-------|
| [`backend/`](backend) | API REST y modelo de datos | PHP 8.2, Laravel 12, Sanctum, Supabase (PostgreSQL) |
| [`frontend/web/td-autos-fe-web/`](frontend/web/td-autos-fe-web) | Aplicación web (SPA) | React 19, TypeScript, Vite |
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

### 2. Frontend web

```bash
cd frontend/web/td-autos-fe-web
npm install
npm run dev
```

## Comandos útiles

| Parte | Tests | Lint / formato | Build |
|-------|-------|----------------|-------|
| Backend | `php artisan test` | `./vendor/bin/pint` | — |
| Frontend web | — | `npm run lint` | `npm run build` |

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
