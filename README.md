# Centinel 🛡️

Sistema web de gestión, monitoreo de dispositivos de red y control de acceso para sedes e infraestructura.

---

## 📁 Estructura del Software y Rutas de Directorios

La estructura base del proyecto, su árbol de archivos y sus rutas iniciales fueron generadas utilizando el template de **Vite (Vanilla JavaScript)**, adaptándose e integrándose con un backend en **PHP sobre XAMPP (Apache + MariaDB)** y un sistema de estilos procesado con **Tailwind CSS v4 + pnpm**.

### Árbol de directorios

```text
centinel/
├── public/                     # Recursos públicos y estáticos del navegador
│   ├── favicon.svg             # Ícono SVG auxiliar
│   ├── icons.svg               # Colección de íconos vectoriales SVG
│   └── vendor/                 # Librerías locales para usar el dashboard sin CDN
│       ├── chart.umd.js        # Distribución local de Chart.js
│       └── jspdf.umd.min.js    # Distribución local de jsPDF
│
├── src/                        # Código fuente de la aplicación
│   ├── assets/                 # Recursos multimedia, íconos y avatares
│   │   ├── Logo Centinel.png   # Logotipo usado en encabezados y favicon
│   │   ├── Tipografia Centinel.png # Nombre visual de Centinel en encabezados
│   │   ├── avatar_gerente.svg  # Avatar vectorial corporativo para rol Gerente
│   │   ├── avatar_tecnico.svg  # Avatar vectorial de soporte para rol Técnico
│   │   ├── security.svg        # Ícono SVG de seguridad y soporte
│   │
│   ├── BD/                     # Capa de datos y conexión a Base de Datos
│   │   ├── DBConn.php          # Script de conexión MySQLi a MariaDB/MySQL
│   │   └── obtenerDatos.php    # Endpoint de consulta de usuarios en BD
│   ├── Modelos/                # Modelos orientados a objetos que representan datos relacionales
│   │   ├── Dispositivo.php     # Consulta de inventario y objetos Dispositivo
│   │   ├── Simulacion.php      # Registro/lectura de mediciones históricas
│   │   └── Reporte.php         # Métricas mensuales por sede o dispositivo
│   │
│   ├── CSS/                    # Estilos del proyecto y configuración de Tailwind CSS
│   │   ├── input.css           # Archivo CSS de entrada (@import "tailwindcss";)
│   │   └── output.css          # CSS compilado generado para desarrollo/producción
│   │
│   ├── JS/                     # Scripts cliente en JavaScript
│   │   ├── main.js             # Punto de entrada modular del frontend
│   │   ├── panelControl.js     # Lógica dinámica del panel de control, avatar y sesión
│   │   ├── menuLateral.js      # Menú lateral compartido en las vistas del sistema
│   │   ├── simulacion.js       # Simulación estocástica basada en estadísticas históricas
│   │   ├── reportes.js         # Dashboards de reportes y análisis de simulaciones
│   │   ├── reportesAnomalias.js # Alta, edición, revisión e historial de anomalías
│   │   ├── notificaciones.js   # Bandeja desplegable y contador de pendientes del usuario
│   │   ├── soporte.js          # Interacción con el formulario de soporte
│   │   ├── historialSimulaciones.js # Tabla paginada del historial de mediciones
│   │   └── validarFormulario.js# Intercepción y envío asíncrono (Fetch API) de credenciales
│   │
│   ├── PHP/                    # Lógica del servidor, endpoints y controladores
│   │   ├── login.php           # API de autenticación, creación de sesión y redirección
│   │   ├── logout.php          # Cierre seguro y destrucción de sesión PHP
│   │   ├── obtenerDispositivos.php # API para consultar inventario de red, métricas y sedes
│   │   ├── obtenerSimulacion.php   # Última medición por dispositivo (monitoreo técnico)
│   │   ├── obtenerHistorialSimulaciones.php # Historial paginado de todas las mediciones
│   │   ├── obtenerEstadisticasSimulacion.php # Estadísticas históricas para el modo automático
│   │   ├── guardarSimulacion.php   # Guarda una tanda de mediciones en una transacción
│   │   ├── obtenerReportes.php     # Reportes mensuales protegidos para Gerente
│   │   ├── obtenerReportesAnomalia.php # Reportes de anomalías y auditoría
│   │   ├── obtenerAnalisisSimulacion.php # Agregados temporales del historial
│   │   ├── guardarReporteAnomalia.php  # Alta/edición gerencial y revisión técnica
│   │   ├── notificaciones.php # Consulta y marcado de notificaciones por usuario
│   │   └── obtenerSesion.php   # Endpoint para validar autenticación y datos de usuario activo
│   │
│   └── Vistas/                 # Vistas y paneles de control
│       ├── Panel de control.html # Vista unificada que se adapta según el rol conectado
│       ├── simulacion.html       # Tabla de simulación para Gerente y Técnico
│       ├── historial-simulaciones.html # Historial completo paginado
│       ├── reportes.html         # Dashboard gerencial y pestaña técnica de anomalías
│       └── soporte.html          # Formulario de soporte y preguntas frecuentes
│
├── centinel.sql                # Script de inicialización y estructura de la BD
├── migracion_reportes_anomalia.sql # Migración para bases Centinel existentes
├── migracion_notificaciones_anomalias.sql # Migración de comentarios y notificaciones
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
| `src/Vistas/Panel de control.html` | Vista (HTML5) | Panel de control unificado con monitoreo por sede y contenido adaptado al rol. El menú lateral compartido se carga en las vistas del sistema. |
| `src/CSS/output.css` | Hoja de estilos | Estilos compilados y optimizados mediante Tailwind CSS v4. |
| `src/JS/main.js` | Script cliente | Punto de entrada modular que orquesta los módulos JavaScript en el login. |
| `src/JS/validarFormulario.js` | Script cliente | Captura el evento `submit`, valida credenciales, envía petición vía `Fetch API` a `login.php` y redirige al panel unificado guardando datos temporales en `sessionStorage`. |
| `src/JS/panelControl.js` | Script cliente | Consulta `obtenerSesion.php`, verifica permisos, asigna el avatar correspondiente (`avatar_gerente.svg` o `avatar_tecnico.svg`), actualiza el badge/saludo y gestiona el cierre de sesión con `logout.php`. |
| `src/JS/menuLateral.js` | Script cliente | Renderiza la navegación lateral común, las sedes disponibles y las secciones permitidas para el rol autenticado. |
| `src/JS/simulacion.js` | Script cliente | Presenta los valores simulados y sus estadísticas históricas; guarda tandas individuales o múltiples. |
| `src/JS/reportes.js` | Script cliente | Gestiona el dashboard gerencial, el análisis estocástico y la navegación de reportes por rol. |
| `src/JS/reportesAnomalias.js` | Script cliente | Permite crear y editar reportes como Gerente y consultar/actualizar su revisión como Técnico. |
| `src/JS/notificaciones.js` | Script cliente | Presenta las notificaciones pendientes en el encabezado y permite marcarlas como leídas. |
| `src/JS/soporte.js` | Script cliente | Valida el formulario de soporte y prepara el mensaje de contacto. |

### Identidad visual y encabezados
Todas las páginas HTML (`index.html` y las vistas de `src/Vistas/`) comparten el logotipo y la tipografía de Centinel, almacenados en `src/assets/Logo Centinel.png` y `src/assets/Tipografia Centinel.png`. El logotipo también se utiliza como favicon. Los encabezados mantienen el mismo fondo azul oscuro y permanecen fijados en la parte superior al desplazarse por la página.

### 2. Procesamiento Backend y API (PHP)
| Ruta / Archivo | Método / Uso | Responsabilidad |
| :--- | :--- | :--- |
| `src/PHP/login.php` | `POST` (JSON) | API de autenticación: verifica credenciales mediante consultas preparadas (`Prepared Statements`), inicia sesión (`$_SESSION`) y responde en formato JSON con redirección directa a `Panel de control.html` y los datos del usuario. |
| `src/PHP/obtenerDispositivos.php` | `GET` (JSON) | Endpoint que retorna métricas, ancho de banda, latencia y sedes de dispositivos de red con soporte relacional y respaldo en memoria. |
| `src/PHP/obtenerSesion.php` | `GET` (JSON) | Endpoint de verificación de sesión: retorna el estado de autenticación (`autenticado: true/false`) y datos de la cuenta activa (`id`, `nombre`, `email`, `rol`). |
| `src/PHP/logout.php` | `POST` (JSON) | Destruye completamente la sesión del servidor y cookies asociadas de forma segura. |
| `src/BD/DBConn.php` | Inclusión PHP | Conexión a la base de datos MariaDB (`centinel`) centralizada con `mysqli`. |
| `src/BD/obtenerDatos.php` | `GET` (JSON) | Endpoint que extrae y entrega en JSON el listado de usuarios registrados. |
| `src/PHP/obtenerEstadisticasSimulacion.php` | `GET` (JSON) | Calcula probabilidad de conectividad, media, desviación y tamaño muestral con historial del dispositivo, su sede o el conjunto global. |
| `src/PHP/guardarSimulacion.php` | `POST` (JSON) | Registra un lote de mediciones simuladas. |
| `src/PHP/obtenerAnalisisSimulacion.php` | `GET` (JSON) | Entrega al Gerente agregados cronológicos para el análisis estocástico. |
| `src/PHP/obtenerReportesAnomalia.php` | `GET` (JSON) | Consulta reportes de anomalías y su historial según el rol y permisos del usuario. |
| `src/PHP/guardarReporteAnomalia.php` | `POST` (JSON) | Crea/edita reportes para Gerencia y registra la revisión técnica con auditoría. |
| `src/PHP/notificaciones.php` | `GET` / `POST` (JSON) | Consulta las notificaciones del usuario autenticado y marca una o todas como leídas. |

### 3. Base de Datos (`centinel.sql`)
Estructura relacional diseñada para soportar:
- `usuario`: Cuentas del sistema con identificador (`id_usuario`), nombre (`name_usu`), correo (`email`), contraseña (`passw`) y niveles de privilegio (`type`: `Gerente`, `Tecnico`, etc.).
- `sede`: Ubicaciones físicas o sucursales de la organización (Miranda, Aragua, Táchira, etc.).
- `dispositivo`: Equipos de red con métricas de ancho de banda (`BW_dispositivo`), latencia y estado.
- `sede_dispositivo`: Tabla intermedia que asocia dispositivos a sus respectivas sedes.
- `simulacion`: Historial append-only de mediciones simuladas con conectividad, latencia, ancho de banda, modo, fecha y metadatos de escenario.
- `simulacion.indice_paso`: identifica las mediciones de las series de escenarios; las mediciones puntuales dejan este campo vacío.

Selecciona o crea la base `centinel` en MariaDB e importa `centinel.sql` para crear el esquema y cargar los datos de demostración, incluido el historial de simulaciones de octubre de 2026. El script de inicialización contiene también las tablas de anomalías, comentarios, notificaciones y auditoría. Las simulaciones y escenarios requieren MariaDB para persistirse; cuando la base no está disponible, algunas vistas usan datos de demostración de la sesión.

### Módulos de simulación y reportes
- El panel principal muestra el inventario y monitoreo por sede. El menú lateral reutilizable aparece en las vistas del sistema y adapta la navegación y el alcance de sedes al rol.
- La vista de simulación mantiene los modos de fecha para mediciones puntuales y permite generar escenarios temporales de caída, latencia elevada, congestión y recuperación. Cada escenario genera y guarda una serie con duración y frecuencia seleccionables; queda asociada al escenario en el historial, sin guardar una configuración para repetirla.
- En modo automático puntual, `obtenerEstadisticasSimulacion.php` usa el historial de mediciones puntuales del dispositivo y recurre a su sede y luego al conjunto global. Se requieren al menos cinco mediciones y dos muestras válidas por métrica. La conectividad usa una estimación Beta(1,1) suavizada; la latencia se genera con una lognormal ajustada a la media y desviación observadas, y el ancho de banda con una Gamma ajustada por momentos. Las series de escenarios se excluyen de este patrón.
- El botón de simulación múltiple permite ejecutar de 1 a 100 tandas aleatorias para los dispositivos visibles, que deben estar todos en modo automático y contar con MariaDB. Antes de cada tanda vuelve a consultar el historial de mediciones puntuales y genera muestras nuevas. Las series de escenarios no alimentan las distribuciones automáticas. Si hay un error, se detiene y muestra cuántas tandas quedaron guardadas; si completa todo, vuelve al panel de “Todas las sedes”.
- El módulo `historial-simulaciones.html` ordena las mediciones por fecha de simulación descendente (desempata por id), permite filtrar por sede y pagina el historial; los escenarios muestran su nombre asociado. El monitoreo por sede consulta `obtenerSimulacion.php` para obtener la última medición guardada de cada dispositivo.
- El Dashboard de Reportes es exclusivo del Gerente y compara todas las simulaciones mensuales, por sede o dispositivo, con gráficas Chart.js. Permite agregar meses a la comparación y exportar el dashboard a PDF mediante jsPDF; la exportación no aparece en la vista del Técnico.
- El Gerente también tiene un análisis estocástico del historial con filtros de sede y dispositivo. Las ventanas son el último año (agrupado por mes), el último mes (por día), la última semana (por día), las últimas 24 horas (por hora) y la última hora (por bloques de 5 minutos). Los intervalos vacíos se muestran sin mediciones y las líneas no interpolan datos ausentes; el ancho de banda usa escala logarítmica cuando los valores extremos comprimen el rango. El año se filtra mediante el índice de `fecha_registro` y se resume en unos 12–13 puntos.
- La pestaña “Anomalías e historial” está disponible para Gerente y Técnico. Gerencia puede crear y editar reportes asociados a una sede o dispositivo; cada edición se registra en el historial. El Técnico actualiza el estado y agrega o edita un comentario por anomalía, que también queda en la auditoría. La bandeja del encabezado notifica a los técnicos cuando Gerencia crea o actualiza reportes y a Gerencia cuando un técnico cambia el estado o comenta. Cada usuario ve su propio contador de notificaciones pendientes y puede marcarlas como leídas. Esta función usa `reporte_anomalia`, `historial_reporte_anomalia`, `comentario_reporte_anomalia` y `notificacion`.
- La página de soporte contiene formulario de contacto y preguntas frecuentes. Las distribuciones de Chart.js y jsPDF se sirven localmente desde `public/vendor/`, sin depender de CDN.
- Las consultas de inventario, historial y métricas convierten las filas de MariaDB en instancias de los modelos PHP en `src/Modelos/`.

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
- **Gráficas y reportes:** Chart.js `4.4.7` para el tacómetro y las gráficas del dashboard; jsPDF `2.5.2` para exportar los reportes a PDF. Ambas dependencias están declaradas en `package.json`.

---

## 🚀 Comandos y Configuración del Entorno

### 1. Instalación de dependencias
Para recrear la carpeta `node_modules` en una nueva máquina o entorno de evaluación:
```bash
pnpm install
```
Este comando instala también Chart.js y jsPDF junto con Tailwind CSS. La vista de reportes carga las distribuciones UMD locales desde `public/vendor/`, por lo que no necesita CDN en tiempo de ejecución.

### 2. Procesamiento de Estilos con Tailwind
Para compilar y escuchar cambios en las clases de Tailwind CSS en tiempo real:

```bash
# Modo desarrollo con auto-recarga de estilos
pnpm dev:css

# Compilación para producción (minificado)
pnpm build:css
```
