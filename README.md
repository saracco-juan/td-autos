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
| [`docs/`](docs) | Documentación técnica: [diseño](docs/design.md), [primeros pasos](docs/getting-started.md), [cómo contribuir](docs/contributing.md), [desarrollo](docs/development.md) e [infraestructura y deploy](docs/infrastructure.md) | Markdown |

## Para desarrollar

Cómo instalar y levantar cada parte, y los comandos de tests, lint y build: [`docs/getting-started.md`](docs/getting-started.md). Ramas, commits e integración continua: [`docs/contributing.md`](docs/contributing.md).
