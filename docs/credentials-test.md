# Credenciales de Prueba (Multitenant & RBAC)

Este documento contiene las cuentas de prueba disponibles para interactuar con el sistema de incidencias georreferenciadas según las organizaciones sembradas en la base de datos y sus respectivos roles.

---

## 1. Cuentas Globales (Sistema)

Estas cuentas tienen alcance global y no pertenecen a ninguna organización específica.

| Rol                      | Correo Electrónico               | Contraseña      | Descripción / Alcance                                                      |
| ------------------------ | -------------------------------- | --------------- | -------------------------------------------------------------------------- |
| **Super Administrador**  | `admin@sistema.com`              | `Admin123!`     | Acceso completo al sistema, organizaciones y todas las incidencias.        |
| **Operador del Sistema** | `operador@sistema.com`           | `Operador123!`  | Acceso técnico y operativo general en la plataforma.                       |
| **Ciudadano (Legacy)**   | `usuario@test.com`               | `Usuario123!`   | Reporta incidencias desde el feed. Ve únicamente sus incidencias.          |
| **Ciudadano (Nuevo)**    | `ciudadano.test@incidencias.com` | `Ciudadano123!` | Usado por el nuevo seeder de multitenant para simular reportes ciudadanos. |

---

## 2. Cuentas de Organizaciones (Seeder Multitenant)

Creadas con el seeder `MultitenantFeatSeeder`. Cada organización tiene asignada una categoría y ubicación específica, y cuenta con un administrador, un operador y un publicador.

### 2.1 GAD Municipal de Quito — Obras Viales

- **Ubicación asignada**: Cantón Quito (`EC-17-01`)
- **Categoría asignada**: Baches y Hundimientos
- **Límite de Reclamos Activos**: 5

| Rol                      | Correo Electrónico                                               | Contraseña       |
| ------------------------ | ---------------------------------------------------------------- | ---------------- |
| **Administrador de Org** | `admin.gad-municipal-de-quito-obras-viales@incidencias.com`      | `Admin123!`      |
| **Operador de Org**      | `operador.gad-municipal-de-quito-obras-viales@incidencias.com`   | `Operador123!`   |
| **Publicador de Org**    | `publicador.gad-municipal-de-quito-obras-viales@incidencias.com` | `Publicador123!` |

### 2.2 GAD Municipal de Guayaquil — Agua y Saneamiento

- **Ubicación asignada**: Cantón Guayaquil (`EC-09-01`)
- **Categoría asignada**: Agua Potable
- **Límite de Reclamos Activos**: 3

| Rol                      | Correo Electrónico                                                         | Contraseña       |
| ------------------------ | -------------------------------------------------------------------------- | ---------------- |
| **Administrador de Org** | `admin.gad-municipal-de-guayaquil-agua-y-saneamiento@incidencias.com`      | `Admin123!`      |
| **Operador de Org**      | `operador.gad-municipal-de-guayaquil-agua-y-saneamiento@incidencias.com`   | `Operador123!`   |
| **Publicador de Org**    | `publicador.gad-municipal-de-guayaquil-agua-y-saneamiento@incidencias.com` | `Publicador123!` |

### 2.3 GAD Municipal de Cuenca — Seguridad Ciudadana

- **Ubicación asignada**: Cantón Cuenca (`EC-01-01`)
- **Categoría asignada**: Robos y Hurtos
- **Límite de Reclamos Activos**: 8
  e

  | Rol | Correo Electrónico | Contraseña |
  |---|---|---|
  | **Administrador de Org** | `admin.gad-municipal-de-cuenca-seguridad-ciudadana@incidencias.com` | `Admin123!` |
  | **Operador de Org** | `operador.gad-municipal-de-cuenca-seguridad-ciudadana@incidencias.com` | `Operador123!` |
  | **Publicador de Org** | `publicador.gad-municipal-de-cuenca-seguridad-ciudadana@incidencias.com` | `Publicador123!` |

### 2.4 GAD Municipal de Ambato — Medio Ambiente

- **Ubicación asignada**: Cantón Ambato (`EC-18-01`)
- **Categoría asignada**: Basureros Clandestinos
- **Límite de Reclamos Activos**: 4

| Rol                      | Correo Electrónico                                                  | Contraseña       |
| ------------------------ | ------------------------------------------------------------------- | ---------------- |
| **Administrador de Org** | `admin.gad-municipal-de-ambato-medio-ambiente@incidencias.com`      | `Admin123!`      |
| **Operador de Org**      | `operador.gad-municipal-de-ambato-medio-ambiente@incidencias.com`   | `Operador123!`   |
| **Publicador de Org**    | `publicador.gad-municipal-de-ambato-medio-ambiente@incidencias.com` | `Publicador123!` |

### 2.5 GAD Municipal de Loja — Control Urbano

- **Ubicación asignada**: Cantón Loja (`EC-11-01`)
- **Categoría asignada**: Construcciones Ilegales
- **Límite de Reclamos Activos**: 5

| Rol                      | Correo Electrónico                                                | Contraseña       |
| ------------------------ | ----------------------------------------------------------------- | ---------------- |
| **Administrador de Org** | `admin.gad-municipal-de-loja-control-urbano@incidencias.com`      | `Admin123!`      |
| **Operador de Org**      | `operador.gad-municipal-de-loja-control-urbano@incidencias.com`   | `Operador123!`   |
| **Publicador de Org**    | `publicador.gad-municipal-de-loja-control-urbano@incidencias.com` | `Publicador123!` |

---

## 3. Cuentas de Organizaciones Secundarias (Seeder General)

Creadas originalmente por `UserSeeder`. Estas organizaciones usan la categoría primera por defecto asignada y cuentan con un Administrador y un Operador por cada una.

### 3.1 GAD Municipal del Cantón Quito (Parent)

- **Email Admin**: `admin.gad-municipal-del-canton-quito@organizacion.com` / `Admin123!`
- **Email Operador**: `operador.gad-municipal-del-canton-quito@organizacion.com` / `Operador123!`

### 3.2 Sucursales de Quito

- **GAD Quito — Zona Centro**:
  - **Admin**: `admin.gad-quito-zona-centro@organizacion.com` / `Admin123!`
  - **Operador**: `operador.gad-quito-zona-centro@organizacion.com` / `Operador123!`
- **GAD Quito — Zona Norte**:
  - **Admin**: `admin.gad-quito-zona-norte@organizacion.com` / `Admin123!`
  - **Operador**: `operador.gad-quito-zona-norte@organizacion.com` / `Operador123!`
- **GAD Quito — Zona Sur**:
  - **Admin**: `admin.gad-quito-zona-sur@organizacion.com` / `Admin123!`
  - **Operador**: `operador.gad-quito-zona-sur@organizacion.com` / `Operador123!`

### 3.3 GAD Municipal del Cantón Guayaquil (Parent)

- **Email Admin**: `admin.gad-municipal-del-canton-guayaquil@organizacion.com` / `Admin123!`
- **Email Operador**: `operador.gad-municipal-del-canton-guayaquil@organizacion.com` / `Operador123!`

### 3.4 Sucursales de Guayaquil

- **GAD Guayaquil — Centro**:
  - **Admin**: `admin.gad-guayaquil-centro@organizacion.com` / `Admin123!`
  - **Operador**: `operador.gad-guayaquil-centro@organizacion.com` / `Operador123!`
- **GAD Guayaquil — Norte**:
  - **Admin**: `admin.gad-guayaquil-norte@organizacion.com` / `Admin123!`
  - **Operador**: `operador.gad-guayaquil-norte@organizacion.com` / `Operador123!`

### 3.5 GAD Municipal del Cantón Cuenca (Parent)

- **Email Admin**: `admin.gad-municipal-del-canton-cuenca@organizacion.com` / `Admin123!`
- **Email Operador**: `operador.gad-municipal-del-canton-cuenca@organizacion.com` / `Operador123!`

### 3.6 Sucursales de Cuenca

- **GAD Cuenca — Centro**:
  - **Admin**: `admin.gad-cuenca-centro@organizacion.com` / `Admin123!`
  - **Operador**: `operador.gad-cuenca-centro@organizacion.com` / `Operador123!`

### 3.7 GAD Municipal del Cantón Ambato

- **Email Admin**: `admin.gad-municipal-del-canton-ambato@organizacion.com` / `Admin123!`
- **Email Operador**: `operador.gad-municipal-del-canton-ambato@organizacion.com` / `Operador123!`

### 3.8 GAD Municipal del Cantón Loja

- **Email Admin**: `admin.gad-municipal-del-canton-loja@organizacion.com` / `Admin123!`
- **Email Operador**: `operador.gad-municipal-del-canton-loja@organizacion.com` / `Operador123!`
