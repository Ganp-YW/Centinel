const $ = (id) => document.getElementById(id);
const POR_PAGINA = 25;
let pagina = 1;
let solicitud = null;

const mostrarConfirmacionReset = async () => {
    const confirmado = window.confirm('¿Seguro que deseas reiniciar todo el historial de simulaciones? Esta acción eliminará todos los registros de la tabla de simulación.');
    if (!confirmado) {
        return;
    }

    try {
        const respuesta = await fetch('../PHP/resetHistorial.php', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' }
        });

        const datos = await respuesta.json();
        if (!respuesta.ok || !datos.success) {
            throw new Error(datos.mensaje || 'No se pudo reiniciar el historial.');
        }

        alert('Historial reiniciado correctamente.');
        pagina = 1;
        await cargarHistorial();
    } catch (error) {
        console.error(error);
        alert(error.message || 'No se pudo reiniciar el historial.');
    }
};

document.addEventListener('DOMContentLoaded', iniciar);

async function iniciar() {
    try {
        const respuesta = await fetch('../PHP/obtenerSesion.php', { credentials: 'include' });
        const sesion = await respuesta.json();
        if (!sesion.autenticado || !sesion.usuario) {
            window.location.href = '../../index.html';
            return;
        }
        const rol = sesion.usuario.rol === 'Tecnico' || sesion.usuario.rol === 'Técnico'
            ? 'Técnico'
            : sesion.usuario.rol;
        if (!['Gerente', 'Técnico'].includes(rol)) {
            window.location.href = 'Panel%20de%20control.html';
            return;
        }
        $('badgeRol').textContent = rol;
        $('headerUserName').textContent = `${sesion.usuario.nombre} · ${rol}`;
        $('headerAvatarImg').src = rol === 'Gerente' ? '../assets/avatar_gerente.svg' : '../assets/avatar_tecnico.svg';
        $('headerAvatarImg').alt = `Avatar ${rol}`;
    } catch (error) {
        $('estadoHistorial').textContent = 'No se pudo validar la sesión. Inicia sesión nuevamente.';
        return;
    }

    $('filtroSedeHistorial').addEventListener('change', () => {
        pagina = 1;
        cargarHistorial();
    });
    $('btnActualizarHistorial').addEventListener('click', cargarHistorial);
    $('btnReiniciarHistorial').addEventListener('click', mostrarConfirmacionReset);
    $('btnAnterior').addEventListener('click', () => {
        if (pagina > 1) {
            pagina--;
            cargarHistorial();
        }
    });
    $('btnSiguiente').addEventListener('click', () => {
        pagina++;
        cargarHistorial();
    });
    $('btnCerrarSesion').addEventListener('click', cerrarSesion);
    await cargarHistorial();
}

function escaparHTML(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, (caracter) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[caracter]);
}

function formatoFecha(fecha) {
    if (!fecha) return 'Sin fecha';
    const fechaLocal = new Date(`${fecha.replace(' ', 'T')}`);
    return Number.isNaN(fechaLocal.getTime())
        ? escaparHTML(fecha)
        : fechaLocal.toLocaleString('es-VE', { dateStyle: 'medium', timeStyle: 'medium' });
}

async function cargarHistorial() {
    solicitud?.abort();
    solicitud = new AbortController();
    $('estadoHistorial').textContent = 'Consultando historial...';
    const parametros = new URLSearchParams({
        pagina: String(pagina),
        por_pagina: String(POR_PAGINA),
        sede: $('filtroSedeHistorial').value
    });

    try {
        const respuesta = await fetch(`../PHP/obtenerHistorialSimulaciones.php?${parametros}`, {
            credentials: 'include',
            signal: solicitud.signal
        });
        const datos = await respuesta.json();
        if (!respuesta.ok || !datos.success || !Array.isArray(datos.simulaciones) || !datos.paginacion) {
            throw new Error(datos.mensaje || 'El servidor no pudo devolver el historial.');
        }

        renderizarFilas(datos.simulaciones);
        const { total, paginas } = datos.paginacion;
        $('totalHistorial').textContent = total;
        $('paginaActual').textContent = `${datos.paginacion.pagina} / ${paginas}`;
        $('btnAnterior').disabled = datos.paginacion.pagina <= 1;
        $('btnSiguiente').disabled = datos.paginacion.pagina >= paginas;
        const inicio = total === 0 ? 0 : (datos.paginacion.pagina - 1) * POR_PAGINA + 1;
        const fin = Math.min(datos.paginacion.pagina * POR_PAGINA, total);
        $('rangoHistorial').textContent = `Mostrando ${inicio}–${fin} de ${total} registros`;
        $('estadoHistorial').textContent = `${datos.origen === 'memoria' ? 'Datos de demostración' : 'Base de datos'} · actualizado ${new Date().toLocaleTimeString('es-VE')}`;
        $('estadoHistorial').className = 'mt-1 text-sm text-slate-500';
    } catch (error) {
        if (error.name === 'AbortError') return;
        $('estadoHistorial').textContent = error.message || 'No se pudo cargar el historial.';
        $('estadoHistorial').className = 'mt-1 text-sm font-semibold text-red-700';
        $('tablaHistorial').innerHTML = '<tr><td colspan="8" class="px-5 py-12 text-center text-red-700">Error al cargar el historial. Intenta actualizar la página.</td></tr>';
    }
}

function renderizarFilas(simulaciones) {
    const cuerpo = $('tablaHistorial');
    if (!simulaciones.length) {
        cuerpo.innerHTML = '<tr><td colspan="8" class="px-5 py-12 text-center text-slate-500">Aún no hay simulaciones registradas para este filtro.</td></tr>';
        return;
    }
    cuerpo.innerHTML = simulaciones.map((simulacion) => {
        const conectado = Number(simulacion.conectividad) === 1;
        const estado = conectado
            ? '<span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"><span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>Conectado</span>'
            : '<span class="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700"><span class="h-1.5 w-1.5 rounded-full bg-red-500"></span>Desconectado</span>';
        const modo = simulacion.modo === 'manual' ? 'Manual' : 'Automático';
        const identificador = simulacion.id_simulacion ? `#${simulacion.id_simulacion}` : 'Demo';
        return `<tr class="transition hover:bg-slate-50">
            <td class="whitespace-nowrap px-5 py-4 text-slate-600">${formatoFecha(simulacion.fecha_registro)}</td>
            <td class="px-4 py-4">
                <p class="font-semibold text-slate-900">${escaparHTML(simulacion.name_dispositivo || `Dispositivo ${simulacion.id_dispositivo}`)}</p>
                <p class="mt-1 font-mono text-xs text-slate-500">${escaparHTML(simulacion.ip_dispositivo || '')}</p>
            </td>
            <td class="px-4 py-4 text-slate-600">${escaparHTML(simulacion.sede || 'Sin asignar')}</td>
            <td class="px-4 py-4">${estado}</td>
            <td class="px-4 py-4 font-medium text-slate-700">${Number(simulacion.latencia).toFixed(1)} ms</td>
            <td class="px-4 py-4 font-medium text-slate-700">${Number(simulacion.ancho_banda).toFixed(1)} Mbps</td>
            <td class="px-4 py-4"><span class="rounded-full ${simulacion.modo === 'manual' ? 'bg-violet-50 text-violet-700' : 'bg-sky-50 text-sky-700'} px-2.5 py-1 text-xs font-semibold">${modo}</span></td>
            <td class="px-4 py-4 font-mono text-xs text-slate-500">${identificador}</td>
        </tr>`;
    }).join('');
}

async function cerrarSesion() {
    try {
        await fetch('../PHP/logout.php', { method: 'POST', credentials: 'include' });
    } finally {
        sessionStorage.removeItem('usuarioActivo');
        window.location.href = '../../index.html';
    }
}
