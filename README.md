# TD Autos

Portal web de recomendación de autos usados y gestión de concesionarias. Proyecto de tesis.

El usuario obtiene recomendaciones de vehículos según su perfil; las concesionarias publican y gestionan su stock (inspecciones, transferencias, publicaciones externas y leads).

## Estructura del repositorio

| Carpeta | Qué contiene | Stack |
|---------|--------------|-------|
| [`backend/`](backend) | API REST y modelo de datos | PHP 8.2, Laravel 12, Sanctum |
| [`frontend/web/td-autos-fe-web/`](frontend/web/td-autos-fe-web) | Aplicación web (SPA) | React 19, TypeScript, Vite |
| `frontend/mobile/` | App móvil | _Pendiente_ |

## Inicio rápido

### Requisitos

- PHP 8.2+ y Composer
- Node.js 20+ y npm

### 1. Backend (http://localhost:8000)

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
php artisan serve
```

Por defecto usa SQLite (`DB_CONNECTION=sqlite`).

### 2. Frontend web (http://localhost:5173)

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

## Estado actual

- [x] Modelo de datos (migraciones del DER)
- [x] Autenticación en la API: registro, login, verificación de email y recuperación de contraseña
- [ ] Pantallas web
- [ ] Recomendación de vehículos
- [ ] Panel de concesionarias
- [ ] Panel de administración
- [ ] App móvil

## Convenciones

- Commits con [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`, `docs:`...).
- Una rama por funcionalidad (`feature/...`) con PR hacia `develop`.
- Código, identificadores y comentarios en inglés; entidades del dominio en español, según el DER.
