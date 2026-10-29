// panelControl.js - Lógica para el panel de control general de Centinel

// Dispositivos por defecto para contingencia o ejecución sin conexión a MariaDB
const DISPOSITIVOS_POR_DEFECTO = [
    {
        id_dispositivo: 1,
        name_dispositivo: 'Router Principal',
        ip_dispositivo: '192.168.1.1',
        status: 1,
        BW_dispositivo: 100,
        latencia_dispositivo: 12,
        fecha: '2026-10-22',
        sede: 'Miranda'
    },
    {
        id_dispositivo: 2,
        name_dispositivo: 'Switch Piso 2',
        ip_dispositivo: '192.168.1.14',
        status: 0,
        BW_dispositivo: 0,
        latencia_dispositivo: 0,
        fecha: '2026-10-22',
        sede: 'Aragua'
    },
    {
        id_dispositivo: 3,
        name_dispositivo: 'Firewall Perimetral',
        ip_dispositivo: '192.168.1.254',
        status: 1,
        BW_dispositivo: 500,
        latencia_dispositivo: 8,
        fecha: '2026-10-23',
        sede: 'Miranda'
    },
    {
        id_dispositivo: 4,
        name_dispositivo: 'Switch Core Aragua',
        ip_dispositivo: '192.168.2.1',
        status: 1,
        BW_dispositivo: 1000,
        latencia_dispositivo: 15,
        fecha: '2026-10-24',
        sede: 'Aragua'
    },
    {
        id_dispositivo: 5,
        name_dispositivo: 'Servidor DNS/DHCP',
        ip_dispositivo: '192.168.2.10',
        status: 1,
        BW_dispositivo: 100,
        latencia_dispositivo: 5,
        fecha: '2026-10-24',
        sede: 'Aragua'
    },
    {
        id_dispositivo: 6,
        name_dispositivo: 'Router Borde Táchira',
        ip_dispositivo: '192.168.3.1',
        status: 1,
        BW_dispositivo: 200,
        latencia_dispositivo: 24,
        fecha: '2026-10-25',
        sede: 'Táchira'
    },
    {
        id_dispositivo: 7,
        name_dispositivo: 'Access Point Planta 1',
        ip_dispositivo: '192.168.3.20',
        status: 0,
        BW_dispositivo: 0,
        latencia_dispositivo: 0,
        fecha: '2026-10-25',
        sede: 'Táchira'
    },
    {
        id_dispositivo: 8,
        name_dispositivo: 'Servidor de Respaldos',
        ip_dispositivo: '192.168.1.50',
        status: 1,
        BW_dispositivo: 300,
        latencia_dispositivo: 11,
        fecha: '2026-10-26',
        sede: 'Miranda'
    }
];

// Estado global de la vista
let todosLosDispositivos = [];
let sedeSeleccionada = 'todas';
let terminoBusqueda = '';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Obtener datos de sesión
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

    // 2. Verificar sesión activa con el backend
    try {
        const res = await fetch('../PHP/obtenerSesion.php', {
            method: 'GET',
            credentials: 'include'
        });
        const data = await res.json();

        if (!data.autenticado || !data.usuario) {
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

    // 3. Inicializar el panel de resumen y dispositivos
    inicializarEventos();
    await cargarDispositivos();
});

// Función para actualizar los elementos según el rol y cuenta activa
function renderizarUsuario(usuario) {
    if (!usuario) return;

    const rolNormalizado = (usuario.rol === 'Tecnico' || usuario.rol === 'Técnico') ? 'Técnico' : usuario.rol;
    document.title = `Centinel - ${rolNormalizado} (${usuario.nombre})`;

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

    const tituloBienvenida = document.getElementById('tituloBienvenida');
    const subtituloBienvenida = document.getElementById('subtituloBienvenida');

    if (tituloBienvenida) {
        tituloBienvenida.textContent = `Bienvenido ${rolNormalizado}`;
    }

    if (subtituloBienvenida) {
        subtituloBienvenida.textContent = 'Estado operativo de los dispositivos de red.';
    }
}

// Cargar dispositivos desde el backend o respaldo
async function cargarDispositivos() {
    try {
        const res = await fetch('../PHP/obtenerDispositivos.php');
        if (!res.ok) throw new Error('Respuesta inválida del servidor');
        const data = await res.json();

        if (data.success && Array.isArray(data.dispositivos) && data.dispositivos.length > 0) {
            todosLosDispositivos = data.dispositivos;
        } else {
            todosLosDispositivos = DISPOSITIVOS_POR_DEFECTO;
        }
    } catch (e) {
        console.warn('Usando catálogo local de dispositivos:', e.message);
        todosLosDispositivos = DISPOSITIVOS_POR_DEFECTO;
    }

    actualizarContadoresSidebar(todosLosDispositivos);
    filtrarYRenderizar();
}

// Actualizar contadores del menú lateral
function actualizarContadoresSidebar(lista) {
    const total = lista.length;
    const miranda = lista.filter(d => normalizarTexto(d.sede) === 'miranda').length;
    const aragua = lista.filter(d => normalizarTexto(d.sede) === 'aragua').length;
    const tachira = lista.filter(d => normalizarTexto(d.sede) === 'tachira').length;

    const badgeTotalSedes = document.getElementById('badgeTotalSedes');
    const badgeMiranda = document.getElementById('badgeMiranda');
    const badgeAragua = document.getElementById('badgeAragua');
    const badgeTachira = document.getElementById('badgeTachira');
    const badgeGestionTotal = document.getElementById('badgeGestionTotal');

    if (badgeTotalSedes) badgeTotalSedes.textContent = total;
    if (badgeMiranda) badgeMiranda.textContent = miranda;
    if (badgeAragua) badgeAragua.textContent = aragua;
    if (badgeTachira) badgeTachira.textContent = tachira;
    if (badgeGestionTotal) badgeGestionTotal.textContent = total;
}

// Filtrar según la sede activa y el buscador de texto
function filtrarYRenderizar() {
    let filtrados = todosLosDispositivos;

    // Filtro por sede
    if (sedeSeleccionada !== 'todas') {
        filtrados = filtrados.filter(d => normalizarTexto(d.sede) === normalizarTexto(sedeSeleccionada));
    }

    // Filtro por búsqueda de texto
    if (terminoBusqueda.trim() !== '') {
        const busq = normalizarTexto(terminoBusqueda);
        filtrados = filtrados.filter(d =>
            normalizarTexto(d.name_dispositivo).includes(busq) ||
            normalizarTexto(d.ip_dispositivo).includes(busq) ||
            normalizarTexto(d.sede).includes(busq)
        );
    }

    renderizarTarjetasResumen(filtrados);
    renderizarTablaDispositivos(filtrados);
}

// Renderizar las 3 tarjetas de estado (KPIs)
function renderizarTarjetasResumen(lista) {
    const total = lista.length;
    const activos = lista.filter(d => Number(d.status) === 1).length;
    
    // Alertas: inactivos o latencia elevada (> 50ms)
    const alertas = lista.filter(d => Number(d.status) === 0 || Number(d.latencia_dispositivo) > 50).length;

    // Latencia promedio de dispositivos activos
    const dispositivosActivos = lista.filter(d => Number(d.status) === 1 && Number(d.latencia_dispositivo) > 0);
    let latenciaPromedio = 0;
    if (dispositivosActivos.length > 0) {
        const suma = dispositivosActivos.reduce((acc, curr) => acc + Number(curr.latencia_dispositivo), 0);
        latenciaPromedio = Math.round(suma / dispositivosActivos.length);
    }

    const kpiDispositivosActivos = document.getElementById('kpiDispositivosActivos');
    const kpiAlertasActivas = document.getElementById('kpiAlertasActivas');
    const kpiLatenciaPromedio = document.getElementById('kpiLatenciaPromedio');
    const kpiLatenciaSubtexto = document.getElementById('kpiLatenciaSubtexto');

    if (kpiDispositivosActivos) {
        kpiDispositivosActivos.textContent = `${activos} / ${total}`;
    }

    if (kpiAlertasActivas) {
        kpiAlertasActivas.textContent = alertas;
    }

    if (kpiLatenciaPromedio) {
        kpiLatenciaPromedio.textContent = latenciaPromedio > 0 ? `${latenciaPromedio} ms` : '-- ms';
    }

    if (kpiLatenciaSubtexto) {
        kpiLatenciaSubtexto.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-sky-500"></span>${sedeSeleccionada === 'todas' ? 'Todas las sedes' : `Sede ${sedeSeleccionada}`}`;
    }
}

// Renderizar filas de la tabla de dispositivos de red
function renderizarTablaDispositivos(lista) {
    const tbody = document.getElementById('tablaDispositivos');
    const contador = document.getElementById('contadorDispositivos');

    if (contador) {
        contador.textContent = `Mostrando ${lista.length} de ${todosLosDispositivos.length} dispositivos`;
    }

    if (!tbody) return;

    if (lista.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="px-5 py-8 text-center text-gray-500 text-sm">
                    No se encontraron dispositivos que coincidan con los criterios seleccionados.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = lista.map(disp => {
        const esActivo = Number(disp.status) === 1;
        const estadoHTML = esActivo
            ? `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Activo</span>`
            : `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800"><span class="w-1.5 h-1.5 rounded-full bg-red-500"></span>Inactivo</span>`;

        const bwTexto = esActivo ? `${disp.BW_dispositivo} Mbps` : '-- Mbps';
        const latenciaTexto = esActivo ? `${disp.latencia_dispositivo} ms` : '-- ms';
        const latenciaColor = !esActivo ? 'text-gray-400' : (disp.latencia_dispositivo > 50 ? 'text-amber-600 font-semibold' : 'text-emerald-600 font-medium');

        return `
            <tr class="hover:bg-gray-50/80 transition">
                <td class="px-5 py-4 font-semibold text-gray-900">${disp.name_dispositivo}</td>
                <td class="px-5 py-4 font-mono text-xs text-gray-600">${disp.ip_dispositivo}</td>
                <td class="px-5 py-4">
                    <span class="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                        ${disp.sede}
                    </span>
                </td>
                <td class="px-5 py-4">${estadoHTML}</td>
                <td class="px-5 py-4 font-medium text-gray-800">${bwTexto}</td>
                <td class="px-5 py-4 ${latenciaColor}">${latenciaTexto}</td>
                <td class="px-5 py-4 text-right">
                    <button class="btn-detalle inline-flex items-center px-3 py-1 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg transition cursor-pointer" data-id="${disp.id_dispositivo}">
                        Detalle
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    // Reasignar eventos a botones de detalle
    tbody.querySelectorAll('.btn-detalle').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = Number(btn.getAttribute('data-id'));
            abrirModalDetalle(id);
        });
    });
}

// Abrir modal con detalles del equipo
function abrirModalDetalle(id) {
    const disp = todosLosDispositivos.find(d => Number(d.id_dispositivo) === id);
    if (!disp) return;

    const modal = document.getElementById('modalDetalle');
    const modalNombre = document.getElementById('modalNombre');
    const modalEstadoBadge = document.getElementById('modalEstadoBadge');
    const modalIP = document.getElementById('modalIP');
    const modalSede = document.getElementById('modalSede');
    const modalBW = document.getElementById('modalBW');
    const modalLatencia = document.getElementById('modalLatencia');
    const modalFecha = document.getElementById('modalFecha');

    const esActivo = Number(disp.status) === 1;

    if (modalNombre) modalNombre.textContent = disp.name_dispositivo;
    if (modalIP) modalIP.textContent = disp.ip_dispositivo;
    if (modalSede) modalSede.textContent = disp.sede;
    if (modalBW) modalBW.textContent = esActivo ? `${disp.BW_dispositivo} Mbps` : 'Sin conexión';
    if (modalLatencia) modalLatencia.textContent = esActivo ? `${disp.latencia_dispositivo} ms` : 'Inaccesible';
    if (modalFecha) modalFecha.textContent = disp.fecha || 'N/A';

    if (modalEstadoBadge) {
        if (esActivo) {
            modalEstadoBadge.textContent = 'Activo';
            modalEstadoBadge.className = 'inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800';
        } else {
            modalEstadoBadge.textContent = 'Inactivo';
            modalEstadoBadge.className = 'inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-800';
        }
    }

    if (modal) modal.classList.remove('hidden');
}

function cerrarModalDetalle() {
    const modal = document.getElementById('modalDetalle');
    if (modal) modal.classList.add('hidden');
}

// Configurar escuchadores de eventos
function inicializarEventos() {
    // 1. Selector de sede en la cabecera de la tabla
    const selectorSede = document.getElementById('selectorSede');
    if (selectorSede) {
        selectorSede.addEventListener('change', (e) => {
            cambiarSede(e.target.value);
        });
    }

    // 2. Links de sedes en la barra lateral
    document.querySelectorAll('.sede-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const sede = link.getAttribute('data-sede');
            cambiarSede(sede);
        });
    });

    // 3. Menú Gestión > Dispositivos
    const menuGestionDispositivos = document.getElementById('menuGestionDispositivos');
    if (menuGestionDispositivos) {
        menuGestionDispositivos.addEventListener('click', (e) => {
            e.preventDefault();
            cambiarSede('todas');
        });
    }

    // 4. Buscador de texto en vivo
    const buscador = document.getElementById('buscadorDispositivos');
    if (buscador) {
        buscador.addEventListener('input', (e) => {
            terminoBusqueda = e.target.value;
            filtrarYRenderizar();
        });
    }

    // 5. Botón de refrescar / actualizar
    const btnRefrescar = document.getElementById('btnRefrescar');
    const iconRefresh = document.getElementById('iconRefresh');
    if (btnRefrescar) {
        btnRefrescar.addEventListener('click', async () => {
            if (iconRefresh) iconRefresh.classList.add('animate-spin');
            await cargarDispositivos();
            setTimeout(() => {
                if (iconRefresh) iconRefresh.classList.remove('animate-spin');
            }, 600);
        });
    }

    // 6. Cerrar modal de detalle
    const modalCerrarBtn = document.getElementById('modalCerrarBtn');
    const modalCerrarBtn2 = document.getElementById('modalCerrarBtn2');
    const modalDetalle = document.getElementById('modalDetalle');

    if (modalCerrarBtn) modalCerrarBtn.addEventListener('click', cerrarModalDetalle);
    if (modalCerrarBtn2) modalCerrarBtn2.addEventListener('click', cerrarModalDetalle);
    if (modalDetalle) {
        modalDetalle.addEventListener('click', (e) => {
            if (e.target === modalDetalle) cerrarModalDetalle();
        });
    }

    // 7. Cierre de sesión
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
}

// Cambiar la sede activa y sincronizar el sidebar y el select
function cambiarSede(sede) {
    sedeSeleccionada = sede || 'todas';

    const selectorSede = document.getElementById('selectorSede');
    if (selectorSede) {
        selectorSede.value = sedeSeleccionada;
    }

    // Actualizar estilos activos del sidebar
    document.querySelectorAll('.sede-link').forEach(link => {
        const linkSede = link.getAttribute('data-sede');
        if (normalizarTexto(linkSede) === normalizarTexto(sedeSeleccionada)) {
            link.className = 'sede-link flex items-center justify-between px-3 py-2 rounded-lg text-sky-700 bg-sky-50 font-semibold transition';
        } else {
            link.className = 'sede-link flex items-center justify-between px-3 py-2 rounded-lg text-gray-700 hover:bg-sky-50 hover:text-sky-700 transition font-medium';
        }
    });

    filtrarYRenderizar();
}

// Utilidad para comparar strings sin acentos ni mayúsculas
function normalizarTexto(texto) {
    return (texto || '')
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}
