# Centinel 🛡️

Sistema web de gestión, monitoreo de dispositivos de red y control de acceso para sedes e infraestructura.

---

## 📁 Estructura del Software y Rutas de Directorios

La estructura base del proyecto, su árbol de archivos y sus rutas iniciales fueron generadas utilizando el template de **Vite (Vanilla JavaScript)**, adaptándose e integrándose con un backend en **PHP sobre XAMPP (Apache + MariaDB)** y un sistema de estilos procesado con **Tailwind CSS v4 + pnpm**.

### Árbol de directorios

```text
centinel/
├── public/                 # Recursos públicos y estáticos del navegador
│   ├── favicon.svg         # Ícono principal de la aplicación
│   └── icons.svg           # Colección de íconos vectoriales SVG
│
├── src/                    # Código fuente de la aplicación
│   ├── assets/             # Recursos multimedia e imágenes internas
│   │   ├── hero.png
│   │   ├── javascript.svg
│   │   └── vite.svg
│   │
│   ├── BD/                 # Capa de datos y conexión a Base de Datos
│   │   └── DBConn.php      # Script de conexión MySQLi a MariaDB/MySQL
│   │
│   ├── CSS/                # Estilos del proyecto y configuración de Tailwind CSS
│   │   ├── input.css       # Archivo CSS de entrada (@import "tailwindcss";)
│   │   └── output.css      # CSS compilado generado para producción/desarrollo
│   │
│   ├── JS/                 # Scripts cliente en JavaScript
│   │   ├── counter.js      # Componentes / utilidades JS
│   │   └── main.js         # Lógica principal del cliente
│   │
│   └── PHP/                # Lógica del servidor, endpoints y controladores
│       └── login.php       # Procesamiento de autenticación y roles de usuario
│
├── centinel.sql            # Script de inicialización y estructura de la BD
├── index.html              # Vista de inicio y punto de entrada (Login)
├── package.json            # Configuración de dependencias y scripts de pnpm
├── pnpm-lock.yaml          # Bloqueo de versiones de dependencias de pnpm
└── README.md               # Documentación general del proyecto
```

---

## 🗺️ Mapa de Rutas y Responsabilidades

### 1. Vistas y Frontend
| Ruta / Archivo | Tipo | Descripción |
| :--- | :--- | :--- |
| `index.html` | Vista (HTML5) | Interfaz inicial del sistema que presenta el formulario de acceso de usuarios. |
| `src/CSS/output.css` | Hoja de estilos | Estilos generados por el compilador de Tailwind CSS vinculados en las vistas. |
| `src/JS/main.js` | Script cliente | Orquestador de interacción del usuario en el navegador. |

### 2. Procesamiento Backend (PHP)
| Ruta / Archivo | Método / Uso | Responsabilidad |
| :--- | :--- | :--- |
| `src/PHP/login.php` | `POST` | Recibe credenciales desde `index.html`, valida roles (`Gerente`, `Tecnico`) y gestiona la sesión. |
| `src/BD/DBConn.php` | Inclusión PHP | Centraliza las credenciales (`host`, `usuario`, `password`, `bd`) e inicia la conexión `$conexion`. |

### 3. Base de Datos (`centinel.sql`)
Estructura relacional diseñada para soportar:
- `usuario`: Cuentas del sistema y niveles de privilegio (`type`: Gerente, Técnico, etc.).
- `sede`: Ubicaciones físicas o sucursales de la organización.
- `dispositivo`: Equipos de red con métricas de ancho de banda (`BW_dispositivo`), latencia y estado.
- `sede_dispositivo`: Tabla intermedia que asocia dispositivos a sus respectivas sedes.

---

## ⚙️ Tecnologías y Entorno

- **Base de Proyecto / Scaffolding:** Vite (Vanilla JavaScript).
- **Servidor Web / Backend:** PHP 8.x sobre servidor local Apache (XAMPP).
- **Base de Datos:** MariaDB / MySQL.
- **Gestor de Paquetes:** `pnpm`.
- **Framework CSS:** Tailwind CSS v4 (`@tailwindcss/cli`).

---

## 🚀 Comandos y Configuración del Entorno

### 1. Instalación de dependencias
Para recrear la carpeta `node_modules` en una nueva máquina o entorno de evaluación:
```bash
pnpm install
```

### 2. Procesamiento de Estilos con Tailwind
Para compilar y escuchar cambios en las clases de Tailwind CSS en tiempo real:

```bash
# Modo desarrollo con auto-recarga de estilos
pnpm dev:css

# Compilación para producción (minificado)
pnpm build:css
```

---

## 📝 Próximos Pasos (En desarrollo)

> *En las siguientes fases se documentará a detalle el flujo de autenticación, la arquitectura de control de acceso por roles (RBAC) y el funcionamiento integral de los módulos de monitoreo.*
