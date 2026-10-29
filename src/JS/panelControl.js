// panelControl.js - Lógica para el panel de control general de Centinel

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Obtener datos iniciales de sessionStorage para renderizado instantáneo
    let usuario = null;
    const cachedData = sessionStorage.getItem('usuarioActivo');
    if (cachedData) {
        try {
            usuario = JSON.parse(cachedData);
            renderizarUsuario(usuario);
        } catch (e) {
            console.error('Error al parsear usuario en caché:', e);
        }
    }

    // 2. Verificar sesión activa con el backend (PHP)
    try {
        const res = await fetch('../PHP/obtenerSesion.php', {
            method: 'GET',
            credentials: 'include'
        });
        const data = await res.json();

        if (!data.autenticado || !data.usuario) {
            // Si no hay sesión válida en el servidor y tampoco caché, redirigir al login
            sessionStorage.removeItem('usuarioActivo');
            window.location.href = '../../index.html';
            return;
        }

        usuario = data.usuario;
        sessionStorage.setItem('usuarioActivo', JSON.stringify(usuario));
        renderizarUsuario(usuario);

    } catch (err) {
        console.warn('No se pudo verificar la sesión con el servidor:', err);
        if (!usuario) {
            window.location.href = '../../index.html';
            return;
        }
    }

    // 3. Manejo del botón de cerrar sesión
    const btnCerrarSesion = document.getElementById('btnCerrarSesion');
    if (btnCerrarSesion) {
        btnCerrarSesion.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                await fetch('../PHP/logout.php', { method: 'POST', credentials: 'include' });
            } catch (error) {
                console.error('Error al cerrar sesión:', error);
            } finally {
                sessionStorage.removeItem('usuarioActivo');
                window.location.href = '../../index.html';
            }
        });
    }
});

// Función para actualizar los elementos según el rol y cuenta activa
function renderizarUsuario(usuario) {
    if (!usuario) return;

    const rolNormalizado = (usuario.rol === 'Tecnico' || usuario.rol === 'Técnico') ? 'Técnico' : usuario.rol;

    // Actualizar título de la pestaña
    document.title = `Centinel - ${rolNormalizado} (${usuario.nombre})`;

    // Elementos del encabezado
    const badgeRol = document.getElementById('badgeRol');
    const headerUserName = document.getElementById('headerUserName');
    const headerAvatarImg = document.getElementById('headerAvatarImg');

    if (headerUserName) {
        headerUserName.textContent = `${usuario.nombre} (${rolNormalizado})`;
    }

    if (headerAvatarImg) {
        if (rolNormalizado === 'Gerente') {
            headerAvatarImg.src = '../assets/avatar_gerente.svg';
            headerAvatarImg.alt = 'Avatar Gerente';
            headerAvatarImg.className = 'w-8 h-8 rounded-full border-2 border-sky-400 object-cover shadow-sm';
        } else if (rolNormalizado === 'Técnico') {
            headerAvatarImg.src = '../assets/avatar_tecnico.svg';
            headerAvatarImg.alt = 'Avatar Técnico';
            headerAvatarImg.className = 'w-8 h-8 rounded-full border-2 border-emerald-400 object-cover shadow-sm';
        }
    }

    // Estilos del badge según el rol
    if (badgeRol) {
        badgeRol.textContent = rolNormalizado;
        badgeRol.className = 'text-xs px-2.5 py-0.5 rounded-full font-medium';
        if (rolNormalizado === 'Gerente') {
            badgeRol.classList.add('bg-sky-600', 'text-white');
        } else if (rolNormalizado === 'Técnico') {
            badgeRol.classList.add('bg-emerald-600', 'text-white');
        } else {
            badgeRol.classList.add('bg-indigo-600', 'text-white');
        }
    }

    // Mensaje de bienvenida
    const tituloBienvenida = document.getElementById('tituloBienvenida');
    const subtituloBienvenida = document.getElementById('subtituloBienvenida');

    if (tituloBienvenida) {
        tituloBienvenida.textContent = `Bienvenido, ${rolNormalizado}`;
    }

    if (subtituloBienvenida) {
        if (rolNormalizado === 'Gerente') {
            subtituloBienvenida.textContent = 'Panel principal de administración de Centinel.';
        } else if (rolNormalizado === 'Técnico') {
            subtituloBienvenida.textContent = 'Panel de operaciones y soporte técnico de Centinel.';
        } else {
            subtituloBienvenida.textContent = 'Panel principal de Centinel.';
        }
    }
}
