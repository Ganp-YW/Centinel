const $ = (id) => document.getElementById(id);
const tabla = $('tablaSimulacion');
const form = $('formSimulacion');
let dispositivos = [];

document.addEventListener('DOMContentLoaded', iniciar);

async function iniciar() {
    try {
        const respuesta = await fetch('../PHP/obtenerSesion.php', { credentials: 'include' });
        const sesion = await respuesta.json();
        if (!sesion.autenticado || !sesion.usuario) {
            window.location.href = '../../index.html';
            return;
        }

        const usuario = sesion.usuario;
        const rol = normalizarRol(usuario.rol);
        if (!['Gerente', 'Técnico'].includes(rol)) {
            window.location.href = 'Panel%20de%20control.html';
            return;
        }
        renderizarUsuario(usuario, rol);

        const inventario = await fetch('../PHP/obtenerDispositivos.php');
        if (!inventario.ok) throw new Error('No fue posible consultar el inventario.');
        const datos = await inventario.json();
        if (!datos.success || !Array.isArray(datos.dispositivos)) {
            throw new Error(datos.mensaje || 'El servidor no devolvió un inventario válido.');
        }
        dispositivos = datos.dispositivos;
        renderizarTabla();
        $('estadoCarga').textContent = `${dispositivos.length} dispositivos disponibles · origen: ${datos.origen || 'servidor'}`;
    } catch (error) {
        $('estadoCarga').textContent = error.message || 'No se pudo cargar el inventario.';
        tabla.innerHTML = '<tr><td colspan="5" class="px-5 py-12 text-center text-red-700">No se pudo cargar el inventario. Verifica que PHP esté activo y vuelve a intentar.</td></tr>';
    }

    $('filtroSede').addEventListener('change', renderizarTabla);
    tabla.addEventListener('change', actualizarContadores);
    tabla.addEventListener('input', actualizarContadores);
    form.addEventListener('submit', guardarSimulacion);
    $('btnReiniciarHistorial').addEventListener('click', reiniciarHistorial);
    $('btnCerrarSesion').addEventListener('click', cerrarSesion);
}

function normalizarRol(rol) {
    return rol === 'Tecnico' || rol === 'Técnico' ? 'Técnico' : rol;
}

function renderizarUsuario(usuario, rol) {
    $('badgeRol').textContent = rol;
    $('headerUserName').textContent = `${usuario.nombre} · ${rol}`;
    $('headerAvatarImg').src = rol === 'Gerente' ? '../assets/avatar_gerente.svg' : '../assets/avatar_tecnico.svg';
    $('headerAvatarImg').alt = `Avatar ${rol}`;
    document.title = `Centinel - Simulación (${rol})`;
    if (rol === 'Gerente') $('linkReportes').classList.remove('hidden');
}

function escaparHTML(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, (caracter) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[caracter]);
}

function renderizarTabla() {
    const sede = $('filtroSede').value;
    const lista = sede === 'todas'
        ? dispositivos
        : dispositivos.filter((dispositivo) => dispositivo.sede === sede);

    $('totalDispositivos').textContent = dispositivos.length;
    if (!lista.length) {
        tabla.innerHTML = '<tr><td colspan="5" class="px-5 py-12 text-center text-slate-500">No hay dispositivos para esta sede.</td></tr>';
        actualizarContadores();
        return;
    }

    tabla.innerHTML = lista.map((dispositivo) => {
        const id = Number(dispositivo.id_dispositivo);
        const conectado = Number(dispositivo.status ?? dispositivo.conectividad) === 1;
        const latencia = Number(dispositivo.latencia_dispositivo ?? dispositivo.latencia ?? 0);
        const anchoBanda = Number(dispositivo.BW_dispositivo ?? dispositivo.ancho_banda ?? 0);
        return `
            <tr data-device-row="${id}" class="align-top transition hover:bg-slate-50">
                <td class="px-5 py-4">
                    <p class="font-semibold text-slate-900">${escaparHTML(dispositivo.name_dispositivo)}</p>
                    <p class="mt-1 font-mono text-xs text-slate-500">${escaparHTML(dispositivo.ip_dispositivo)} · ${escaparHTML(dispositivo.sede || 'Sin asignar')}</p>
                </td>
                <td class="px-4 py-4">
                    <select data-field="modo" aria-label="Modo de simulación para ${escaparHTML(dispositivo.name_dispositivo)}" class="w-36 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200">
                        <option value="automatico">Automático</option>
                        <option value="manual">Manual</option>
                    </select>
                </td>
                <td class="px-4 py-4">
                    <select data-field="conectividad" aria-label="Conectividad para ${escaparHTML(dispositivo.name_dispositivo)}" disabled class="w-36 rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 disabled:cursor-not-allowed">
                        <option value="1" ${conectado ? 'selected' : ''}>Conectado</option>
                        <option value="0" ${conectado ? '' : 'selected'}>Desconectado</option>
                    </select>
                </td>
                <td class="px-4 py-4">
                    <input data-field="latencia" type="number" min="0" max="10000" step="0.1" value="${latencia}" disabled aria-label="Latencia en milisegundos para ${escaparHTML(dispositivo.name_dispositivo)}" class="w-32 rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 disabled:cursor-not-allowed">
                </td>
                <td class="px-4 py-4">
                    <input data-field="ancho_banda" type="number" min="0" max="1000000" step="0.1" value="${anchoBanda}" disabled aria-label="Ancho de banda en Mbps para ${escaparHTML(dispositivo.name_dispositivo)}" class="w-40 rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 disabled:cursor-not-allowed">
                </td>
            </tr>`;
    }).join('');

    actualizarContadores();
}

tabla.addEventListener('change', (evento) => {
    const modo = evento.target.closest('[data-field="modo"]');
    if (!modo) return;
    const fila = modo.closest('tr');
    const manual = modo.value === 'manual';
    fila.querySelectorAll('[data-field]:not([data-field="modo"])').forEach((campo) => {
        campo.disabled = !manual;
        campo.classList.toggle('bg-slate-100', !manual);
        campo.classList.toggle('text-slate-500', !manual);
        campo.classList.toggle('bg-white', manual);
        campo.classList.toggle('text-slate-800', manual);
        campo.classList.toggle('disabled:cursor-not-allowed', !manual);
    });
});

function actualizarContadores() {
    const filas = [...tabla.querySelectorAll('tr[data-device-row]')];
    const manuales = filas.filter((fila) => fila.querySelector('[data-field="modo"]').value === 'manual').length;
    $('totalManuales').textContent = manuales;
    $('totalAutomaticos').textContent = filas.length - manuales;
}

function generarValoresAutomaticos() {
    const conectado = Math.random() > 0.08;
    return {
        conectividad: conectado ? 1 : 0,
        latencia: conectado ? Number((5 + Math.random() * 95).toFixed(1)) : 0,
        ancho_banda: conectado ? Number((10 + Math.random() * 990).toFixed(1)) : 0
    };
}

async function reiniciarHistorial() {
    const confirmado = window.confirm('¿Seguro que deseas reiniciar todo el historial de simulaciones? Esta acción eliminará todos los registros y no se puede deshacer.');
    if (!confirmado) return;

    const boton = $('btnReiniciarHistorial');
    const botonGuardar = $('btnGuardarSimulacion');
    const mensaje = $('mensajeSimulacion');
    boton.disabled = true;
    botonGuardar.disabled = true;
    boton.textContent = 'Reiniciando...';
    try {
        const respuesta = await fetch('../PHP/resetHistorial.php', {
            method: 'POST',
            credentials: 'include'
        });
        const resultado = await respuesta.json();
        if (!respuesta.ok || !resultado.success) {
            throw new Error(resultado.mensaje || 'No se pudo reiniciar el historial.');
        }

        mensaje.textContent = resultado.origen === 'memoria'
            ? 'Historial de demostración reiniciado; no se modificó la base de datos.'
            : 'Historial de simulaciones reiniciado correctamente en la base de datos.';
        mensaje.className = 'text-sm font-semibold text-emerald-700';
        $('linkHistorial').classList.remove('hidden');
    } catch (error) {
        mensaje.textContent = error.message || 'No se pudo reiniciar el historial.';
        mensaje.className = 'text-sm font-semibold text-red-700';
    } finally {
        boton.disabled = false;
        botonGuardar.disabled = false;
        boton.textContent = 'Reiniciar historial';
    }
}

async function guardarSimulacion(evento) {
    evento.preventDefault();
    const boton = $('btnGuardarSimulacion');
    const mensaje = $('mensajeSimulacion');
    const filas = [...tabla.querySelectorAll('tr[data-device-row]')];
    const payload = [];

    for (const fila of filas) {
        const modo = fila.querySelector('[data-field="modo"]').value;
        const id = Number(fila.dataset.deviceRow);
        if (modo === 'automatico') {
            const dispositivo = dispositivos.find((elemento) => Number(elemento.id_dispositivo) === id);
            payload.push({
                id_dispositivo: id,
                name_dispositivo: dispositivo?.name_dispositivo || '',
                ip_dispositivo: dispositivo?.ip_dispositivo || '',
                sede: dispositivo?.sede || '',
                modo,
                ...generarValoresAutomaticos()
            });
            continue;
        }

        const dispositivo = dispositivos.find((elemento) => Number(elemento.id_dispositivo) === id);
        const conectividad = Number(fila.querySelector('[data-field="conectividad"]').value);
        const latencia = conectividad ? Number(fila.querySelector('[data-field="latencia"]').value) : 0;
        const anchoBanda = conectividad ? Number(fila.querySelector('[data-field="ancho_banda"]').value) : 0;
        if (conectividad && (!Number.isFinite(latencia) || latencia < 0 || !Number.isFinite(anchoBanda) || anchoBanda < 0)) {
            mensaje.textContent = 'Revisa los valores manuales: deben ser números iguales o mayores que cero.';
            mensaje.className = 'text-sm font-semibold text-red-700';
            fila.querySelector('[data-field="latencia"]').focus();
            return;
        }
        payload.push({
            id_dispositivo: id,
            name_dispositivo: dispositivo?.name_dispositivo || '',
            ip_dispositivo: dispositivo?.ip_dispositivo || '',
            sede: dispositivo?.sede || '',
            modo,
            conectividad,
            latencia: conectividad ? latencia : 0,
            ancho_banda: conectividad ? anchoBanda : 0
        });
    }

    if (!payload.length) {
        mensaje.textContent = 'No hay dispositivos para simular.';
        mensaje.className = 'text-sm font-semibold text-amber-700';
        return;
    }

    boton.disabled = true;
    boton.textContent = 'Guardando...';
    mensaje.textContent = 'Enviando las mediciones al servidor...';
    mensaje.className = 'text-sm text-slate-600';
    try {
        const respuesta = await fetch('../PHP/guardarSimulacion.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ dispositivos: payload })
        });
        const resultado = await respuesta.json();
        if (!respuesta.ok || !resultado.success) {
            throw new Error(resultado.mensaje || 'El servidor rechazó la simulación.');
        }

        const esMock = resultado.origen === 'memoria';
        mensaje.textContent = `${resultado.mensaje || 'Simulación registrada'}: ${resultado.registros} registros${esMock ? ' (modo demostración; no persistido en MariaDB)' : ' en la base de datos'}.`;
        mensaje.className = `text-sm font-semibold ${esMock ? 'text-amber-700' : 'text-emerald-700'}`;
        $('linkHistorial').classList.remove('hidden');
        payload.forEach((medicion) => {
            const dispositivo = dispositivos.find((elemento) => Number(elemento.id_dispositivo) === medicion.id_dispositivo);
            if (dispositivo) {
                dispositivo.status = medicion.conectividad;
                dispositivo.BW_dispositivo = medicion.ancho_banda;
                dispositivo.latencia_dispositivo = medicion.latencia;
            }
            const fila = tabla.querySelector(`tr[data-device-row="${medicion.id_dispositivo}"]`);
            if (fila) {
                fila.querySelector('[data-field="conectividad"]').value = String(medicion.conectividad);
                fila.querySelector('[data-field="latencia"]').value = medicion.latencia;
                fila.querySelector('[data-field="ancho_banda"]').value = medicion.ancho_banda;
            }
        });
    } catch (error) {
        mensaje.textContent = error.message || 'No se pudo guardar la simulación.';
        mensaje.className = 'text-sm font-semibold text-red-700';
    } finally {
        boton.disabled = false;
        boton.textContent = 'Confirmar y guardar simulación';
    }
}

async function cerrarSesion() {
    try {
        await fetch('../PHP/logout.php', { method: 'POST', credentials: 'include' });
    } finally {
        sessionStorage.removeItem('usuarioActivo');
        window.location.href = '../../index.html';
    }
}
