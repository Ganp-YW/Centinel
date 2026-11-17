const $ = (id) => document.getElementById(id);
let rolActual = '';
let opciones = { sedes: [], dispositivos: [] };
let reportes = [];
let reporteEditando = null;
const etiquetas = {
    tipo_objetivo: 'Tipo de objetivo',
    id_sede: 'Sede (ID)',
    id_dispositivo: 'Dispositivo (ID)',
    nombre_objetivo: 'Objetivo',
    ip_objetivo: 'Dirección IP',
    tipo_error: 'Tipo de error',
    titulo: 'Título',
    detalles: 'Detalles',
    prioridad: 'Prioridad',
    estado: 'Estado',
    fecha_evento: 'Fecha y hora del evento'
};

document.addEventListener('DOMContentLoaded', iniciar);

async function iniciar() {
    try {
        const respuesta = await fetch('../PHP/obtenerSesion.php', { credentials: 'include' });
        const sesion = await respuesta.json();
        if (!respuesta.ok || !sesion.autenticado || !sesion.usuario) {
            throw new Error(sesion.mensaje || 'Inicia sesión nuevamente.');
        }
        rolActual = ['Tecnico', 'Técnico'].includes(sesion.usuario.rol) ? 'Técnico' : sesion.usuario.rol;
        if (!['Gerente', 'Técnico'].includes(rolActual)) {
            throw new Error('No tienes permiso para consultar reportes de anomalías.');
        }
        if (rolActual === 'Gerente') {
            $('formularioReporteContenedor').classList.remove('hidden');
            $('formReporteAnomalia').addEventListener('submit', guardarReporte);
        }
    } catch (error) {
        mostrarMensaje(error.message || 'No se pudo validar la sesión.', true);
        $('listaReportesAnomalia').innerHTML = '';
        return;
    }

    $('tipoObjetivoReporte').addEventListener('change', actualizarObjetivo);
    $('btnCancelarEdicionReporte').addEventListener('click', cancelarEdicion);
    $('btnActualizarAnomalias').addEventListener('click', cargarReportes);
    $('listaReportesAnomalia').addEventListener('click', gestionarAccionLista);
    cargarReportes();
}

function escaparHTML(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, (caracter) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[caracter]);
}

function mostrarMensaje(texto, error = false) {
    const mensaje = $('mensajeAnomalias');
    mensaje.textContent = texto;
    mensaje.className = `text-sm ${error ? 'font-semibold text-red-700' : 'text-slate-500'}`;
}

function formatoFecha(fecha) {
    if (!fecha) return 'Sin fecha';
    const fechaLocal = new Date(String(fecha).replace(' ', 'T'));
    return Number.isNaN(fechaLocal.getTime())
        ? escaparHTML(fecha)
        : fechaLocal.toLocaleString('es-VE', { dateStyle: 'medium', timeStyle: 'short' });
}

function fechaLocalParaInput(fecha = new Date()) {
    const ajusteZona = fecha.getTimezoneOffset() * 60000;
    return new Date(fecha.getTime() - ajusteZona).toISOString().slice(0, 16);
}

async function cargarReportes() {
    $('listaReportesAnomalia').innerHTML = '<p class="px-5 py-10 text-center text-sm text-slate-500">Consultando reportes...</p>';
    try {
        const respuesta = await fetch('../PHP/obtenerReportesAnomalia.php', { credentials: 'include', cache: 'no-store' });
        const datos = await respuesta.json();
        if (!respuesta.ok || !datos.success || !Array.isArray(datos.reportes) || !datos.opciones) {
            throw new Error(datos.mensaje || 'No se pudieron cargar los reportes.');
        }
        opciones = datos.opciones;
        reportes = datos.reportes;
        renderizarOpcionesObjetivo();
        renderizarReportes();
        mostrarMensaje(`${reportes.length} reporte${reportes.length === 1 ? '' : 's'} · cambios registrados en el historial.`);
        return true;
    } catch (error) {
        $('listaReportesAnomalia').innerHTML = `<p class="px-5 py-10 text-center text-sm font-semibold text-red-700">${escaparHTML(error.message || 'No se pudo consultar la lista.')}</p>`;
        mostrarMensaje(error.message || 'No se pudieron cargar los reportes.', true);
        return false;
    }
}

function renderizarOpcionesObjetivo() {
    $('idSedeReporte').innerHTML = opciones.sedes.map((sede) =>
        `<option value="${sede.id}">${escaparHTML(sede.nombre)}</option>`
    ).join('');
    $('idDispositivoReporte').innerHTML = opciones.dispositivos.map((dispositivo) =>
        `<option value="${dispositivo.id}">${escaparHTML(dispositivo.nombre)} · ${escaparHTML(dispositivo.ip)}${dispositivo.sede ? ` · ${escaparHTML(dispositivo.sede)}` : ''}</option>`
    ).join('');
    actualizarObjetivo();
}

function actualizarObjetivo() {
    const porSede = $('tipoObjetivoReporte').value === 'sede';
    $('campoSedeReporte').classList.toggle('hidden', !porSede);
    $('campoDispositivoReporte').classList.toggle('hidden', porSede);
    $('idSedeReporte').required = porSede;
    $('idSedeReporte').disabled = !porSede;
    $('idDispositivoReporte').required = !porSede;
    $('idDispositivoReporte').disabled = porSede;
}

function renderizarHistorial(historial) {
    if (!historial.length) return '<p class="mt-3 text-sm text-slate-500">Este reporte aún no tiene eventos de historial.</p>';
    return historial.map((evento) => {
        const antes = evento.datos_anteriores || {};
        const despues = evento.datos_nuevos || {};
        const campos = [...new Set([...Object.keys(antes), ...Object.keys(despues)])]
            .filter((campo) => JSON.stringify(antes[campo] ?? null) !== JSON.stringify(despues[campo] ?? null));
        const cambios = campos.map((campo) => {
            const valorAntes = antes[campo] ?? '—';
            const valorDespues = despues[campo] ?? '—';
            return `<li><span class="font-semibold">${escaparHTML(etiquetas[campo] || campo)}:</span> ${escaparHTML(valorAntes)} <span aria-label="cambió a" class="text-slate-400">→</span> ${escaparHTML(valorDespues)}</li>`;
        }).join('');
        const accion = evento.accion === 'creado'
            ? 'Reporte creado'
            : evento.accion === 'cambio_estado'
                ? 'Estado actualizado por el técnico'
                : 'Reporte editado';
        return `<li class="border-l-2 border-sky-200 pl-4">
            <p class="font-semibold text-slate-800">${accion}</p>
            <p class="mt-1 text-xs text-slate-500">${formatoFecha(evento.fecha_cambio)} · ${escaparHTML(evento.nombre_usuario)}</p>
            ${cambios ? `<ul class="mt-2 space-y-1 text-sm text-slate-600">${cambios}</ul>` : '<p class="mt-2 text-sm text-slate-500">Sin cambios en los campos.</p>'}
        </li>`;
    }).join('');
}

function etiquetaEstado(estado) {
    return {
        pendiente: 'Pendiente',
        en_revision: 'En revisión',
        resuelto: 'Resuelto'
    }[estado] || estado;
}

function renderizarReportes() {
    const contenedor = $('listaReportesAnomalia');
    if (!reportes.length) {
        contenedor.innerHTML = '<p class="px-5 py-10 text-center text-sm text-slate-500">No hay reportes de anomalías registrados.</p>';
        return;
    }

    contenedor.innerHTML = reportes.map((reporte) => {
        const objetivo = reporte.tipo_objetivo === 'dispositivo'
            ? `${reporte.nombre_objetivo}${reporte.ip_objetivo ? ` · ${reporte.ip_objetivo}` : ''}`
            : reporte.nombre_objetivo;
        const prioridad = {
            critica: 'bg-red-100 text-red-800',
            alta: 'bg-orange-100 text-orange-800',
            media: 'bg-amber-100 text-amber-800',
            baja: 'bg-slate-100 text-slate-700'
        }[reporte.prioridad] || 'bg-slate-100 text-slate-700';
        const controles = rolActual === 'Gerente'
            ? `<button type="button" data-editar-reporte="${reporte.id_reporte}" class="rounded-lg border border-sky-200 px-3 py-2 text-xs font-bold text-sky-800 hover:bg-sky-50">Editar</button>`
            : `<div class="flex flex-wrap items-center gap-2">
                <label class="sr-only" for="estadoTecnico${reporte.id_reporte}">Estado del reporte ${reporte.id_reporte}</label>
                <select id="estadoTecnico${reporte.id_reporte}" data-estado-reporte class="rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs">
                    <option value="pendiente" ${reporte.estado === 'pendiente' ? 'selected' : ''}>Pendiente</option>
                    <option value="en_revision" ${reporte.estado === 'en_revision' ? 'selected' : ''}>En revisión</option>
                    <option value="resuelto" ${reporte.estado === 'resuelto' ? 'selected' : ''}>Resuelto</option>
                </select>
                <button type="button" data-estado-id="${reporte.id_reporte}" class="rounded-lg border border-sky-200 px-3 py-2 text-xs font-bold text-sky-800 hover:bg-sky-50">Guardar estado</button>
            </div>`;
        return `<article class="p-5 sm:p-6">
            <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-2">
                        <span class="rounded-full px-2.5 py-1 text-xs font-bold ${prioridad}">${escaparHTML(reporte.prioridad)}</span>
                        <span class="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800">${escaparHTML(etiquetaEstado(reporte.estado))}</span>
                        <span class="text-xs text-slate-500">#${reporte.id_reporte} · ${escaparHTML(reporte.tipo_error)}</span>
                    </div>
                    <h4 class="mt-3 break-words text-lg font-bold text-slate-900">${escaparHTML(reporte.titulo)}</h4>
                    <p class="mt-1 text-sm font-semibold text-slate-700">${escaparHTML(objetivo)} · ${reporte.tipo_objetivo === 'dispositivo' ? 'Dispositivo' : 'Sede'}</p>
                    <p class="mt-1 text-xs text-slate-500">Evento: ${formatoFecha(reporte.fecha_evento)} · Creado por ${escaparHTML(reporte.nombre_creador)} · Actualizado: ${formatoFecha(reporte.fecha_actualizacion)}</p>
                    <p class="mt-3 whitespace-pre-wrap break-words text-sm text-slate-600">${escaparHTML(reporte.detalles)}</p>
                </div>
                <div class="shrink-0">${controles}</div>
            </div>
            <details class="mt-5 border-t border-slate-100 pt-4">
                <summary class="cursor-pointer text-sm font-bold text-sky-800 hover:text-sky-950">Ver historial de cambios (${reporte.historial.length})</summary>
                <ol class="mt-4 space-y-4">${renderizarHistorial(reporte.historial)}</ol>
            </details>
        </article>`;
    }).join('');
}

function gestionarAccionLista(evento) {
    const botonEditar = evento.target.closest('[data-editar-reporte]');
    if (botonEditar && rolActual === 'Gerente') {
        iniciarEdicion(Number(botonEditar.dataset.editarReporte));
        return;
    }
    const botonEstado = evento.target.closest('[data-estado-id]');
    if (botonEstado && rolActual === 'Técnico') {
        actualizarEstado(Number(botonEstado.dataset.estadoId));
    }
}

function iniciarEdicion(id) {
    const reporte = reportes.find((elemento) => elemento.id_reporte === id);
    if (!reporte) return;
    reporteEditando = reporte.id_reporte;
    $('tituloFormularioReporte').textContent = `Editar reporte #${reporte.id_reporte}`;
    $('btnGuardarReporte').textContent = 'Guardar cambios';
    $('btnCancelarEdicionReporte').classList.remove('hidden');
    $('tipoObjetivoReporte').value = reporte.tipo_objetivo;
    actualizarObjetivo();
    $('idSedeReporte').value = reporte.id_sede ?? '';
    $('idDispositivoReporte').value = reporte.id_dispositivo ?? '';
    $('tipoErrorReporte').value = reporte.tipo_error;
    $('fechaEventoReporte').value = String(reporte.fecha_evento).replace(' ', 'T').slice(0, 16);
    $('prioridadReporte').value = reporte.prioridad;
    $('estadoReporte').value = reporte.estado;
    $('tituloReporte').value = reporte.titulo;
    $('detallesReporte').value = reporte.detalles;
    $('panelAnomalias').scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('tituloFormularioReporte').focus();
}

function cancelarEdicion() {
    reporteEditando = null;
    $('formReporteAnomalia').reset();
    $('fechaEventoReporte').value = fechaLocalParaInput();
    $('tituloFormularioReporte').textContent = 'Crear reporte de anomalía';
    $('btnGuardarReporte').textContent = 'Guardar reporte';
    $('btnCancelarEdicionReporte').classList.add('hidden');
    actualizarObjetivo();
}

async function guardarReporte(evento) {
    evento.preventDefault();
    const formulario = new FormData(evento.currentTarget);
    const tipoObjetivo = formulario.get('tipo_objetivo');
    const payload = {
        accion: reporteEditando ? 'editar' : 'crear',
        tipo_objetivo: tipoObjetivo,
        id_sede: tipoObjetivo === 'sede' ? formulario.get('id_sede') : null,
        id_dispositivo: tipoObjetivo === 'dispositivo' ? formulario.get('id_dispositivo') : null,
        tipo_error: formulario.get('tipo_error'),
        titulo: formulario.get('titulo'),
        detalles: formulario.get('detalles'),
        prioridad: formulario.get('prioridad'),
        estado: formulario.get('estado'),
        fecha_evento: formulario.get('fecha_evento')
    };
    if (reporteEditando) payload.id_reporte = reporteEditando;
    const guardado = await enviarCambios(payload);
    if (guardado) {
        cancelarEdicion();
    }
}

async function actualizarEstado(id) {
    const estado = $(`estadoTecnico${id}`).value;
    await enviarCambios({ accion: 'estado', id_reporte: id, estado });
}

async function enviarCambios(payload) {
    const boton = $('btnGuardarReporte');
    if (payload.accion !== 'estado') {
        boton.disabled = true;
        boton.textContent = 'Guardando...';
    }
    try {
        const respuesta = await fetch('../PHP/guardarReporteAnomalia.php', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const datos = await respuesta.json();
        if (!respuesta.ok || !datos.success) {
            throw new Error(datos.mensaje || 'No se pudo guardar el reporte.');
        }
        const listaActualizada = await cargarReportes();
        if (listaActualizada) mostrarMensaje(datos.mensaje || 'Cambios guardados.');
        return true;
    } catch (error) {
        mostrarMensaje(error.message || 'No se pudo guardar el reporte.', true);
        return false;
    } finally {
        if (payload.accion !== 'estado') {
            boton.disabled = false;
            boton.textContent = reporteEditando ? 'Guardar cambios' : 'Guardar reporte';
        }
    }
}

if ($('fechaEventoReporte')) {
    $('fechaEventoReporte').value = fechaLocalParaInput();
}
