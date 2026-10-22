# TD Autos

[![Quality gate status](https://sonarcloud.io/api/project_badges/measure?project=saracco-juan_td-autos&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=saracco-juan_td-autos)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=saracco-juan_td-autos&metric=coverage)](https://sonarcloud.io/summary/new_code?id=saracco-juan_td-autos)

TD Autos ayuda a quien quiere comprar un auto usado a decidir mejor, y a las concesionarias a gestionar su stock. Proyecto de tesis de Juan Saracco y Mariano Giardina.

- **Compradores**: responden un diagnóstico corto y reciben recomendaciones de vehículos según su perfil, con checklists para la inspección y la transferencia.
- **Concesionarias**: publican y administran su inventario, con suscripción mensual.
- **Administradores**: dan de alta y supervisan a las concesionarias y sus pagos.

## Dónde verlo

| Ambiente | Web | Se actualiza con |
|----------|-----|------------------|
| Producción | https://td-autos.vercel.app | cada merge a `main` |
| Desarrollo | https://td-autos-git-develop-juans-projects-e2baddd8.vercel.app | cada merge a `develop` |

La API de cada ambiente responde en `<web>/backend` (por ejemplo, `https://td-autos.vercel.app/backend/up` devuelve `200` si está viva). En el plan gratuito la API se duerme sin tráfico: la primera carga después de un rato puede tardar cerca de un minuto. Cómo está armado y configurado cada ambiente: [`docs/infrastructure.md`](docs/infrastructure.md).

Otros lugares para consultar:

- Calidad de código y cobertura: [SonarQube Cloud](https://sonarcloud.io/summary/new_code?id=saracco-juan_td-autos).
- Estado de los builds: [GitHub Actions](https://github.com/saracco-juan/td-autos/actions).

## Estructura del repositorio

| Carpeta | Qué contiene | Stack |
|---------|--------------|-------|
| [`backend/`](backend) | API REST y modelo de datos | PHP 8.2, Laravel 12, Sanctum, Supabase (PostgreSQL) |
| [`frontend/web/`](frontend/web) | Aplicación web (SPA) | React 19, TypeScript, Vite |
| [`frontend/mobile/`](frontend/mobile) | App móvil | React Native, Expo, TypeScript |
| [`frontend/shared/`](frontend/shared) | Lógica pura compartida por web y mobile (modelo del diagnóstico) | TypeScript, sin dependencias |
| [`docs/`](docs) | Documentación técnica: [diseño](docs/design.md), [primeros pasos](docs/getting-started.md), [desarrollo](docs/development.md) e [infraestructura y deploy](docs/infrastructure.md) | Markdown |

## Para desarrollar

Cómo instalar y levantar cada parte, y los comandos de tests, lint y build: [`docs/getting-started.md`](docs/getting-started.md).

## Integración continua

El workflow [`.github/workflows/ci.yml`](.github/workflows/ci.yml) corre en cada push y pull request hacia `develop` y `main`:

| Job | Qué verifica |
|-----|--------------|
| Backend | `./vendor/bin/pint --test` y `php artisan test` con cobertura |
| Frontend web | `npm run lint`, `npm run test:coverage` y `npm run build` |
| App móvil | `npm run lint`, `npm run typecheck`, `npm run test:coverage` y `npx expo export --platform android` |
| Duplicación (solo PR) | `node scripts/check-duplication.mjs` contra la rama base: falla antes de Sonar si el código nuevo supera el 3% duplicado |
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
