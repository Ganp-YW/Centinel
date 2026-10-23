# Centinel 🛡️

Sistema web de gestión, monitoreo de dispositivos de red y control de acceso para sedes e infraestructura.

---

## 📁 Estructura del Software y Rutas de Directorios

La estructura base del proyecto, su árbol de archivos y sus rutas iniciales fueron generadas utilizando el template de **Vite (Vanilla JavaScript)**, adaptándose e integrándose con un backend en **PHP sobre XAMPP (Apache + MariaDB)** y un sistema de estilos procesado con **Tailwind CSS v4 + pnpm**.

### Árbol de directorios

```text
centinel/
├── public/                     # Recursos públicos y estáticos del navegador
│   ├── favicon.svg             # Ícono principal de la aplicación
│   └── icons.svg               # Colección de íconos vectoriales SVG
│
├── src/                        # Código fuente de la aplicación
│   ├── assets/                 # Recursos multimedia e imágenes internas
│   │   ├── hero.png
│   │   ├── javascript.svg
│   │   └── vite.svg
│   │
│   ├── BD/                     # Capa de datos y conexión a Base de Datos
│   │   ├── DBConn.php          # Script de conexión MySQLi a MariaDB/MySQL
│   │   └── obtenerDatos.php    # Endpoint de consulta de usuarios en BD
│   │
│   ├── CSS/                    # Estilos del proyecto y configuración de Tailwind CSS
│   │   ├── input.css           # Archivo CSS de entrada (@import "tailwindcss";)
│   │   └── output.css          # CSS compilado generado para desarrollo/producción
│   │
│   ├── JS/                     # Scripts cliente en JavaScript
│   │   ├── main.js             # Punto de entrada modular del frontend
│   │   └── validarFormulario.js# Intercepción y envío asíncrono (Fetch API) de credenciales
│   │
│   ├── PHP/                    # Lógica del servidor, endpoints y controladores
│   │   └── login.php           # API de autenticación, control de sesiones y roles
│   │
│   └── Vistas/                 # Vistas privadas según rol de usuario
│       ├── gerente.html        # Vista y panel exclusivo para rol Gerente
│       └── tecnico.html        # Vista y panel exclusivo para rol Técnico
│
├── centinel.sql                # Script de inicialización y estructura de la BD
├── index.html                  # Vista inicial y formulario de autenticación (Login)
├── package.json                # Configuración de dependencias y scripts de pnpm
├── pnpm-lock.yaml              # Bloqueo de versiones de dependencias de pnpm
└── README.md                   # Documentación general del proyecto
```

---

## 🗺️ Mapa de Rutas y Responsabilidades

### 1. Vistas y Frontend
| Ruta / Archivo | Tipo | Descripción |
| :--- | :--- | :--- |
| `index.html` | Vista (HTML5) | Interfaz inicial con formulario para inicio de sesión. |
| `src/Vistas/gerente.html` | Vista (HTML5) | Panel de control principal para usuarios con rol `Gerente`. |
| `src/Vistas/tecnico.html` | Vista (HTML5) | Panel de operaciones y monitoreo para usuarios con rol `Tecnico`. |
| `src/CSS/output.css` | Hoja de estilos | Estilos generados por el compilador de Tailwind CSS v4. |
| `src/JS/main.js` | Script cliente | Punto de entrada modular que orquesta los módulos JavaScript. |
| `src/JS/validarFormulario.js` | Script cliente | Captura el evento `submit`, valida datos en el DOM, envía la petición vía `Fetch API` y gestiona las respuestas sin recargar la página. |

### 2. Procesamiento Backend y API (PHP)
| Ruta / Archivo | Método / Uso | Responsabilidad |
| :--- | :--- | :--- |
| `src/PHP/login.php` | `POST` (JSON) | API de autenticación: verifica credenciales mediante consultas preparadas (`Prepared Statements`), inicia sesión (`$_SESSION`) y responde en formato JSON con la ruta de redirección según el rol (`Gerente` o `Tecnico`). |
| `src/BD/DBConn.php` | Inclusión PHP | Conexión a la base de datos MariaDB (`centinel`) centralizada con `mysqli`. |
| `src/BD/obtenerDatos.php` | `GET` (JSON) | Endpoint que extrae y entrega en JSON el listado de usuarios registrados. |

### 3. Base de Datos (`centinel.sql`)
Estructura relacional diseñada para soportar:
- `usuario`: Cuentas del sistema con identificador (`id_usuario`), nombre (`name_usu`), correo (`email`), contraseña (`passw`) y niveles de privilegio (`type`: `Gerente`, `Tecnico`, etc.).
- `sede`: Ubicaciones físicas o sucursales de la organización.
- `dispositivo`: Equipos de red con métricas de ancho de banda (`BW_dispositivo`), latencia y estado.
- `sede_dispositivo`: Tabla intermedia que asocia dispositivos a sus respectivas sedes.

---

## 🔐 Flujo de Autenticación y Control de Acceso

1. **Envío asíncrono:** El usuario ingresa sus datos en `index.html`. `validarFormulario.js` intercepta el evento `submit` evitando recargas tradicionales de la página.
2. **Petición Fetch:** Se empaquetan los datos con `FormData` y se envían por `POST` a `src/PHP/login.php`.
3. **Consulta segura:** `login.php` busca al usuario por nombre de usuario (`name_usu`) o correo (`email`) usando sentencias preparadas contra inyección SQL.
4. **Validación:** Comprueba la contraseña ingresada con la almacenada en la base de datos.
5. **Respuesta JSON:**
   - **Error:** Si las credenciales fallan, devuelve `{"success": false, "message": "..."}` y JS muestra el mensaje en el DOM de forma inmediata.
   - **Éxito:** Si son válidas, inicia sesión en el servidor (`$_SESSION`), define la ruta según el rol (`src/Vistas/gerente.html` o `src/Vistas/tecnico.html`) y devuelve `{"success": true, "redirect": "..."}` para que JS realice la redirección correspondiente.

---

## ⚙️ Tecnologías y Entorno

- **Base de Proyecto / Scaffolding:** Vite (Vanilla JavaScript / ES Modules).
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
