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
│   ├── assets/                 # Recursos multimedia, íconos y avatares
│   │   ├── avatar_gerente.svg  # Avatar vectorial corporativo para rol Gerente
│   │   ├── avatar_tecnico.svg  # Avatar vectorial de soporte para rol Técnico
│   │   ├── hero.png            # Imagen ilustrativa
│   │   ├── javascript.svg      # Ícono oficial de JavaScript
│   │   ├── security.svg        # Ícono SVG de seguridad y soporte
│   │   └── vite.svg            # Logo de la plataforma
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
│   │   ├── panelControl.js     # Lógica dinámica del panel de control, avatar y sesión
│   │   └── validarFormulario.js# Intercepción y envío asíncrono (Fetch API) de credenciales
│   │
│   ├── PHP/                    # Lógica del servidor, endpoints y controladores
│   │   ├── login.php           # API de autenticación, creación de sesión y redirección
│   │   ├── logout.php          # Cierre seguro y destrucción de sesión PHP
│   │   └── obtenerSesion.php   # Endpoint para validar autenticación y datos de usuario activo
│   │
│   └── Vistas/                 # Vistas y paneles de control
│       └── Panel de control.html # Vista unificada que se adapta según el rol conectado
│
├── centinel.sql                # Script de inicialización y estructura de la BD
├── index.html                  # Vista inicial y formulario de autenticación (Login)
├── package.json                # Configuración de dependencias y scripts de pnpm
├── pnpm-lock.yaml              # Bloqueo de versiones de dependencias de pnpm
├── pnpm-workspace.yaml         # Configuración del workspace de pnpm
└── README.md                   # Documentación general del proyecto
```

---

## 🗺️ Mapa de Rutas y Responsabilidades

### 1. Vistas y Frontend
| Ruta / Archivo | Tipo | Descripción |
| :--- | :--- | :--- |
| `index.html` | Vista (HTML5) | Interfaz inicial con formulario para inicio de sesión. |
| `src/Vistas/Panel de control.html` | Vista (HTML5) | Panel de control unificado. Incluye menú lateral fijo (*Monitoreo por sede: Miranda, Aragua, Táchira*) y espacio central que adapta avatar, badge y saludo según el rol. |
| `src/CSS/output.css` | Hoja de estilos | Estilos compilados y optimizados mediante Tailwind CSS v4. |
| `src/JS/main.js` | Script cliente | Punto de entrada modular que orquesta los módulos JavaScript en el login. |
| `src/JS/validarFormulario.js` | Script cliente | Captura el evento `submit`, valida credenciales, envía petición vía `Fetch API` a `login.php` y redirige al panel unificado guardando datos temporales en `sessionStorage`. |
| `src/JS/panelControl.js` | Script cliente | Consulta `obtenerSesion.php`, verifica permisos, asigna el avatar correspondiente (`avatar_gerente.svg` o `avatar_tecnico.svg`), actualiza el badge/saludo y gestiona el cierre de sesión con `logout.php`. |

### 2. Procesamiento Backend y API (PHP)
| Ruta / Archivo | Método / Uso | Responsabilidad |
| :--- | :--- | :--- |
| `src/PHP/login.php` | `POST` (JSON) | API de autenticación: verifica credenciales mediante consultas preparadas (`Prepared Statements`), inicia sesión (`$_SESSION`) y responde en formato JSON con redirección directa a `Panel de control.html` y los datos del usuario. |
| `src/PHP/obtenerSesion.php` | `GET` (JSON) | Endpoint de verificación de sesión: retorna el estado de autenticación (`autenticado: true/false`) y datos de la cuenta activa (`id`, `nombre`, `email`, `rol`). |
| `src/PHP/logout.php` | `POST` (JSON) | Destruye completamente la sesión del servidor y cookies asociadas de forma segura. |
| `src/BD/DBConn.php` | Inclusión PHP | Conexión a la base de datos MariaDB (`centinel`) centralizada con `mysqli`. |
| `src/BD/obtenerDatos.php` | `GET` (JSON) | Endpoint que extrae y entrega en JSON el listado de usuarios registrados. |

### 3. Base de Datos (`centinel.sql`)
Estructura relacional diseñada para soportar:
- `usuario`: Cuentas del sistema con identificador (`id_usuario`), nombre (`name_usu`), correo (`email`), contraseña (`passw`) y niveles de privilegio (`type`: `Gerente`, `Tecnico`, etc.).
- `sede`: Ubicaciones físicas o sucursales de la organización (Miranda, Aragua, Táchira, etc.).
- `dispositivo`: Equipos de red con métricas de ancho de banda (`BW_dispositivo`), latencia y estado.
- `sede_dispositivo`: Tabla intermedia que asocia dispositivos a sus respectivas sedes.

---

## 🔐 Flujo de Autenticación y Control de Acceso

1. **Envío asíncrono:** El usuario ingresa sus datos en `index.html`. `validarFormulario.js` intercepta el evento `submit` evitando recargas de página.
2. **Petición Fetch:** Se empaquetan las credenciales con `FormData` y se envían por `POST` a `src/PHP/login.php`.
3. **Consulta segura:** `login.php` busca al usuario por nombre de usuario (`name_usu`) o correo (`email`) usando sentencias preparadas contra inyección SQL.
4. **Validación:** Comprueba la contraseña ingresada con la almacenada en la base de datos.
5. **Respuesta JSON:**
   - **Error:** Si las credenciales fallan, devuelve `{"success": false, "message": "..."}` y JS muestra el mensaje en pantalla.
   - **Éxito:** Si son válidas, inicia sesión en el servidor (`$_SESSION`), define la ruta fija `src/Vistas/Panel de control.html` y devuelve `{"success": true, "redirect": "...", "usuario": {...}}`.
6. **Adaptación de la Vista:** `panelControl.js` valida la sesión activa con `obtenerSesion.php`. Al detectar:
   - **Gerente:** Carga el avatar ejecutivo (`avatar_gerente.svg`), badge azul y saludo `"Bienvenido, Gerente"`.
   - **Técnico:** Carga el avatar técnico (`avatar_tecnico.svg`), badge verde y saludo `"Bienvenido, Técnico"`.

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
