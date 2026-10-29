// 1. Seleccionar los elementos del DOM
const form = document.querySelector('form');
const usuarioInput = document.getElementById('usuarioCorreo');
const passwordInput = document.getElementById('password');
const mensajeError = document.getElementById('mensajeError');

// 2. Escuchar el evento de envío del formulario
form.addEventListener('submit', async (e) => {
    // Evitamos que el formulario recargue la página automáticamente
    e.preventDefault();

    // Limpiar mensajes de error previos
    mensajeError.textContent = '';
    mensajeError.className = '';

    // Validación básica en el frontend
    if (!usuarioInput.value.trim() || !passwordInput.value.trim()) {
        mostrarError('Por favor completa todos los campos.');
        return;
    }

    // 3. Preparar los datos a enviar
    // FormData toma automáticamente los campos por su atributo 'name' (usuario_correo y password)
    // de forma que PHP los pueda leer directamente con $_POST
    const datos = new FormData(form);

    try {
        // 4. Enviar la petición al backend con Fetch
        const respuesta = await fetch('src/PHP/login.php', {
            method: 'POST',
            body: datos
        });

        // 5. Convertir la respuesta de PHP a JSON
        const data = await respuesta.json();

        // 6. Verificar la respuesta que nos dio la API
        if (data.success) {
            console.log(`Bienvenido ${data.rol}`);

            // Guardamos la información del usuario en sessionStorage para acceso en el panel
            if (data.usuario) {
                sessionStorage.setItem('usuarioActivo', JSON.stringify(data.usuario));
            }

            // Redirigir al panel de control general
            window.location.href = data.redirect;
        } else {
            // Si las credenciales fallaron, mostramos el mensaje sin recargar
            mostrarError(data.message || 'Usuario o contraseña incorrectos.');
        }


    } catch (error) {
        // Manejo de errores de red o si PHP devuelve un error 500 / sintaxis no JSON
        console.error('Error en la petición:', error);
        mostrarError('Hubo un problema de conexión con el servidor.');
    }
});

// Función auxiliar para mostrar el error en pantalla
function mostrarError(mensaje) {
    mensajeError.textContent = mensaje;
    // Clases opcionales para estilizar el error con Tailwind
    mensajeError.className = 'text-red-500 text-sm font-semibold text-center mt-2';
}
