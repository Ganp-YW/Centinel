const $ = (id) => document.getElementById(id);
const tabla = $('tablaSimulacion');
const form = $('formSimulacion');
let dispositivos = [];
let estadisticasDispositivos = {};
let errorEstadisticas = '';

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

        try {
            const respuestaEstadisticas = await fetch('../PHP/obtenerEstadisticasSimulacion.php', { credentials: 'include' });
            const datosEstadisticas = await respuestaEstadisticas.json();
            if (!respuestaEstadisticas.ok || !datosEstadisticas.success || !datosEstadisticas.estadisticas) {
                throw new Error(datosEstadisticas.mensaje || 'No se pudieron cargar las estadísticas históricas.');
            }
            estadisticasDispositivos = datosEstadisticas.estadisticas;
        } catch (error) {
            errorEstadisticas = error.message || 'No se pudieron cargar las estadísticas históricas.';
            console.error(errorEstadisticas, error);
        }

        renderizarTabla();
        const totalConEstadisticas = dispositivos.filter((dispositivo) =>
            estadisticasDispositivos[Number(dispositivo.id_dispositivo)]?.disponible
        ).length;
        $('estadoCarga').textContent = errorEstadisticas
            ? `${dispositivos.length} dispositivos disponibles · ${errorEstadisticas} Puedes simular en modo manual.`
            : `${dispositivos.length} dispositivos disponibles · ${totalConEstadisticas} con estadísticas históricas`;
    } catch (error) {
        $('estadoCarga').textContent = error.message || 'No se pudo cargar el inventario.';
        tabla.innerHTML = '<tr><td colspan="5" class="px-5 py-12 text-center text-red-700">No se pudo cargar el inventario. Verifica que PHP esté activo y vuelve a intentar.</td></tr>';
    }

    $('filtroSede').addEventListener('change', renderizarTabla);
    tabla.addEventListener('change', actualizarContadores);
    tabla.addEventListener('input', actualizarContadores);
    tabla.addEventListener('change', cambiarModoFila);
    $('btnRegenerarValores').addEventListener('click', regenerarValoresAutomaticos);
    form.addEventListener('submit', guardarSimulacion);
    $('btnSimularVarias').addEventListener('click', simularVariasVeces);
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
        const estadisticas = estadisticasDispositivos[id];
        const tieneEstadisticas = estadisticas?.disponible === true;
        const modoInicial = tieneEstadisticas ? 'automatico' : 'manual';
        const muestra = tieneEstadisticas ? generarValoresAutomaticos(estadisticas) : null;
        const conectado = muestra
            ? muestra.conectividad === 1
            : Number(dispositivo.status ?? dispositivo.conectividad) === 1;
        const latencia = muestra?.latencia ?? Number(dispositivo.latencia_dispositivo ?? dispositivo.latencia ?? 0);
        const anchoBanda = muestra?.ancho_banda ?? Number(dispositivo.BW_dispositivo ?? dispositivo.ancho_banda ?? 0);
        return `
            <tr data-device-row="${id}" class="align-top transition hover:bg-slate-50">
                <td class="wrap-break-words px-2 py-3 sm:px-3 sm:py-4">
                    <p class="font-semibold text-slate-900">${escaparHTML(dispositivo.name_dispositivo)}</p>
                    <p class="mt-1 break-all font-mono text-[0.65rem] text-slate-500 sm:text-xs">${escaparHTML(dispositivo.ip_dispositivo)} · ${escaparHTML(dispositivo.sede || 'Sin asignar')}</p>
                </td>
                <td class="px-1 py-3 sm:px-2 sm:py-4">
                    <select data-field="modo" aria-label="Modo de simulación para ${escaparHTML(dispositivo.name_dispositivo)}" class="w-full min-w-0 rounded-lg border border-slate-300 bg-white px-0.5 py-2 text-[0.6rem] focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 sm:px-2 sm:text-sm">
                        <option value="automatico" ${modoInicial === 'automatico' ? 'selected' : ''}>Automático</option>
                        <option value="manual" ${modoInicial === 'manual' ? 'selected' : ''}>Manual</option>
                    </select>
                </td>
                <td class="px-1 py-3 sm:px-2 sm:py-4">
                    <select data-field="conectividad" aria-label="Conectividad para ${escaparHTML(dispositivo.name_dispositivo)}" ${modoInicial === 'automatico' ? 'disabled' : ''} class="w-full min-w-0 rounded-lg border border-slate-300 ${modoInicial === 'automatico' ? 'bg-slate-100 text-slate-500' : 'bg-white text-slate-800'} px-0.5 py-2 text-[0.6rem] focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 disabled:cursor-not-allowed sm:px-2 sm:text-sm">
                        <option value="1" ${conectado ? 'selected' : ''}>Conectado</option>
                        <option value="0" ${conectado ? '' : 'selected'}>Desconectado</option>
                    </select>
                    <p data-stat="probabilidad" class="mt-1 text-[0.6rem] leading-tight text-slate-500 sm:text-xs">${tieneEstadisticas ? `P(conectado) ${(estadisticas.probabilidad_conectado * 100).toFixed(1)}% · ${etiquetaOrigen(estadisticas.origen)} · n=${estadisticas.total}` : 'Sin estadísticas suficientes'}</p>
                </td>
                <td class="px-1 py-3 sm:px-2 sm:py-4">
                    <input data-field="latencia" type="number" min="0" max="10000" step="0.1" value="${latencia}" ${modoInicial === 'automatico' ? 'disabled' : ''} aria-label="Latencia en milisegundos para ${escaparHTML(dispositivo.name_dispositivo)}" class="w-full min-w-0 rounded-lg border border-slate-300 ${modoInicial === 'automatico' ? 'bg-slate-100 text-slate-500' : 'bg-white text-slate-800'} px-1 py-2 text-[0.65rem] focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 disabled:cursor-not-allowed sm:px-2 sm:text-sm">
                    <p data-stat="latencia" class="mt-1 text-[0.6rem] leading-tight text-slate-500 sm:text-xs">${tieneEstadisticas ? `μ ${estadisticas.media_latencia.toFixed(1)} · σ ${estadisticas.desviacion_latencia.toFixed(1)} · n=${estadisticas.n_latencia}` : ''}</p>
                </td>
                <td class="px-1 py-3 sm:px-2 sm:py-4">
                    <input data-field="ancho_banda" type="number" min="0" max="1000000" step="0.1" value="${anchoBanda}" ${modoInicial === 'automatico' ? 'disabled' : ''} aria-label="Ancho de banda en Mbps para ${escaparHTML(dispositivo.name_dispositivo)}" class="w-full min-w-0 rounded-lg border border-slate-300 ${modoInicial === 'automatico' ? 'bg-slate-100 text-slate-500' : 'bg-white text-slate-800'} px-1 py-2 text-[0.65rem] focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 disabled:cursor-not-allowed sm:px-2 sm:text-sm">
                    <p data-stat="ancho_banda" class="mt-1 text-[0.6rem] leading-tight text-slate-500 sm:text-xs">${tieneEstadisticas ? `μ ${estadisticas.media_ancho_banda.toFixed(1)} · σ ${estadisticas.desviacion_ancho_banda.toFixed(1)} · n=${estadisticas.n_ancho_banda}` : ''}</p>
                </td>
            </tr>`;
    }).join('');

    actualizarContadores();
}

function actualizarEstadisticasVisibles() {
    for (const fila of tabla.querySelectorAll('tr[data-device-row]')) {
        const id = Number(fila.dataset.deviceRow);
        const estadisticas = estadisticasDispositivos[id];
        const probabilidad = fila.querySelector('[data-stat="probabilidad"]');
        const latencia = fila.querySelector('[data-stat="latencia"]');
        const anchoBanda = fila.querySelector('[data-stat="ancho_banda"]');

        if (!estadisticas?.disponible) {
            probabilidad.textContent = 'Sin estadísticas suficientes';
            latencia.textContent = '';
            anchoBanda.textContent = '';
            continue;
        }

        probabilidad.textContent = `P(conectado) ${(estadisticas.probabilidad_conectado * 100).toFixed(2)}% · ${etiquetaOrigen(estadisticas.origen)} · n=${estadisticas.total}`;
        latencia.textContent = `μ ${estadisticas.media_latencia.toFixed(2)} · σ ${estadisticas.desviacion_latencia.toFixed(2)} · n=${estadisticas.n_latencia}`;
        anchoBanda.textContent = `μ ${estadisticas.media_ancho_banda.toFixed(2)} · σ ${estadisticas.desviacion_ancho_banda.toFixed(2)} · n=${estadisticas.n_ancho_banda}`;
    }
}

function cambiarModoFila(evento) {
    const modo = evento.target.closest('[data-field="modo"]');
    if (!modo) return;
    const fila = modo.closest('tr');
    const manual = modo.value === 'manual';
    if (!manual && !generarMuestraParaFila(fila)) {
        modo.value = 'manual';
        actualizarContadores();
        $('mensajeSimulacion').textContent = 'No hay suficientes datos históricos para generar valores automáticos para este dispositivo.';
        $('mensajeSimulacion').className = 'text-sm font-semibold text-amber-700';
        return;
    }

    fila.querySelectorAll('[data-field]:not([data-field="modo"])').forEach((campo) => {
        campo.disabled = !manual;
        campo.classList.toggle('bg-slate-100', !manual);
        campo.classList.toggle('text-slate-500', !manual);
        campo.classList.toggle('bg-white', manual);
        campo.classList.toggle('text-slate-800', manual);
        campo.classList.toggle('disabled:cursor-not-allowed', !manual);
    });
}

function actualizarContadores() {
    const filas = [...tabla.querySelectorAll('tr[data-device-row]')];
    const manuales = filas.filter((fila) => fila.querySelector('[data-field="modo"]').value === 'manual').length;
    $('totalManuales').textContent = manuales;
    $('totalAutomaticos').textContent = filas.length - manuales;
}

function uniforme() {
    return Math.random();
}

function normalEstandar() {
    const u1 = Math.max(uniforme(), Number.EPSILON);
    const u2 = uniforme();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function gammaEstandar(forma) {
    if (forma < 1) {
        return gammaEstandar(forma + 1) * Math.pow(Math.max(uniforme(), Number.EPSILON), 1 / forma);
    }

    const d = forma - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    for (let intento = 0; intento < 100; intento++) {
        const normal = normalEstandar();
        const base = 1 + c * normal;
        if (base <= 0) continue;

        const v = base ** 3;
        const u = uniforme();
        if (u < 1 - 0.0331 * normal ** 4
            || Math.log(Math.max(u, Number.EPSILON)) < 0.5 * normal ** 2 + d * (1 - v + Math.log(v))) {
            return d * v;
        }
    }
    throw new Error('No se pudo generar una muestra de ancho de banda.');
}

function generarValoresAutomaticos(estadisticas) {
    const conectado = uniforme() < estadisticas.probabilidad_conectado;
    if (!conectado) {
        return { conectividad: 0, latencia: 0, ancho_banda: 0 };
    }

    const mediaLatencia = estadisticas.media_latencia;
    const desviacionLatencia = estadisticas.desviacion_latencia;
    const varianzaLog = Math.log1p((desviacionLatencia / mediaLatencia) ** 2);
    const latencia = mediaLatencia === 0
        ? 0
        : Math.exp(Math.log(mediaLatencia) - varianzaLog / 2 + Math.sqrt(varianzaLog) * normalEstandar());

    const mediaAnchoBanda = estadisticas.media_ancho_banda;
    const desviacionAnchoBanda = estadisticas.desviacion_ancho_banda;
    const anchoBanda = desviacionAnchoBanda === 0
        ? mediaAnchoBanda
        : gammaEstandar((mediaAnchoBanda / desviacionAnchoBanda) ** 2)
            * (desviacionAnchoBanda ** 2 / mediaAnchoBanda);

    const muestra = {
        conectividad: 1,
        latencia: Number(latencia.toFixed(1)),
        ancho_banda: Number(anchoBanda.toFixed(1))
    };
    if (!Number.isFinite(muestra.latencia) || !Number.isFinite(muestra.ancho_banda)) {
        throw new Error('Las estadísticas históricas no permiten generar valores numéricos válidos.');
    }
    return muestra;
}

function etiquetaOrigen(origen) {
    return {
        dispositivo: 'dispositivo',
        sede: 'sede',
        global: 'global'
    }[origen] ?? origen;
}

function generarMuestraParaFila(fila) {
    const id = Number(fila.dataset.deviceRow);
    const estadisticas = estadisticasDispositivos[id];
    if (!estadisticas?.disponible) return false;

    const muestra = generarValoresAutomaticos(estadisticas);
    fila.querySelector('[data-field="conectividad"]').value = String(muestra.conectividad);
    fila.querySelector('[data-field="latencia"]').value = muestra.latencia;
    fila.querySelector('[data-field="ancho_banda"]').value = muestra.ancho_banda;
    return true;
}

function regenerarValoresAutomaticos() {
    const filasAutomaticas = [...tabla.querySelectorAll('tr[data-device-row]')]
        .filter((fila) => fila.querySelector('[data-field="modo"]').value === 'automatico');
    let generados = 0;
    try {
        filasAutomaticas.forEach((fila) => {
            if (generarMuestraParaFila(fila)) generados++;
        });
        $('mensajeSimulacion').textContent = generados
            ? `Se generaron nuevos valores para ${generados} dispositivos usando el historial mostrado.`
            : 'No hay datos históricos suficientes para generar valores automáticos.';
        $('mensajeSimulacion').className = `text-sm font-semibold ${generados ? 'text-sky-700' : 'text-amber-700'}`;
    } catch (error) {
        $('mensajeSimulacion').textContent = error.message || 'No se pudieron generar los valores automáticos.';
        $('mensajeSimulacion').className = 'text-sm font-semibold text-red-700';
    }
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

    boton.disabled = true;
    boton.textContent = 'Guardando...';
    mensaje.textContent = 'Enviando las mediciones al servidor...';
    mensaje.className = 'text-sm text-slate-600';
    try {
        const payload = construirPayloadSimulacion();
        await guardarLoteSimulacion(payload);
        window.location.href = 'Panel%20de%20control.html?sede=todas';
    } catch (error) {
        if (error.fila) error.fila.querySelector('[data-field="modo"]')?.focus();
        mensaje.textContent = error.message || 'No se pudo guardar la simulación.';
        mensaje.className = 'text-sm font-semibold text-red-700';
    } finally {
        boton.disabled = false;
        boton.textContent = 'Guardar simulación';
    }
}

function construirPayloadSimulacion({ generarAutomaticos = false } = {}) {
    const filas = [...tabla.querySelectorAll('tr[data-device-row]')];
    if (!filas.length) throw new Error('No hay dispositivos para simular.');

    return filas.map((fila) => {
        const modo = fila.querySelector('[data-field="modo"]').value;
        const id = Number(fila.dataset.deviceRow);
        const dispositivo = dispositivos.find((elemento) => Number(elemento.id_dispositivo) === id);
        if (modo === 'automatico') {
            const estadisticas = estadisticasDispositivos[id];
            if (!estadisticas?.disponible) {
                const error = new Error('Este dispositivo no tiene suficientes estadísticas históricas. Selecciona modo manual para continuar.');
                error.fila = fila;
                throw error;
            }
            if (generarAutomaticos && !generarMuestraParaFila(fila)) {
                throw new Error(`No se pudo generar una muestra para ${dispositivo?.name_dispositivo || `el dispositivo ${id}`}.`);
            }
        }

        const conectividad = Number(fila.querySelector('[data-field="conectividad"]').value);
        const latencia = conectividad ? Number(fila.querySelector('[data-field="latencia"]').value) : 0;
        const anchoBanda = conectividad ? Number(fila.querySelector('[data-field="ancho_banda"]').value) : 0;
        if (conectividad && (!Number.isFinite(latencia) || latencia < 0 || !Number.isFinite(anchoBanda) || anchoBanda < 0)) {
            const error = new Error('Revisa los valores manuales: deben ser números iguales o mayores que cero.');
            error.fila = fila;
            throw error;
        }

        return {
            id_dispositivo: id,
            name_dispositivo: dispositivo?.name_dispositivo || '',
            ip_dispositivo: dispositivo?.ip_dispositivo || '',
            sede: dispositivo?.sede || '',
            modo,
            conectividad,
            latencia: conectividad ? latencia : 0,
            ancho_banda: conectividad ? anchoBanda : 0
        };
    });
}

async function cargarEstadisticasActualizadas() {
    const respuesta = await fetch('../PHP/obtenerEstadisticasSimulacion.php', {
        credentials: 'include',
        cache: 'no-store'
    });
    const datos = await respuesta.json();
    if (!respuesta.ok || !datos.success || !datos.estadisticas) {
        throw new Error(datos.mensaje || 'No se pudieron actualizar las estadísticas históricas.');
    }
    estadisticasDispositivos = datos.estadisticas;
    errorEstadisticas = '';
    actualizarEstadisticasVisibles();
}

async function guardarLoteSimulacion(payload) {
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
    return resultado;
}

function bloquearControlesSimulacion() {
    const controles = [
        ...form.querySelectorAll('input, select, button'),
        $('filtroSede'),
        $('btnRegenerarValores')
    ];
    const estadosPrevios = controles.map((control) => [control, control.disabled]);
    controles.forEach((control) => {
        control.disabled = true;
    });
    return () => estadosPrevios.forEach(([control, deshabilitado]) => {
        control.disabled = deshabilitado;
    });
}

async function simularVariasVeces() {
    const mensaje = $('mensajeSimulacion');
    const boton = $('btnSimularVarias');
    const cantidad = Number($('cantidadSimulaciones').value);
    const filas = [...tabla.querySelectorAll('tr[data-device-row]')];

    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 100) {
        mensaje.textContent = 'Indica un número entero de repeticiones entre 1 y 100.';
        mensaje.className = 'text-sm font-semibold text-amber-700';
        $('cantidadSimulaciones').focus();
        return;
    }
    if (!filas.length) {
        mensaje.textContent = 'No hay dispositivos para simular.';
        mensaje.className = 'text-sm font-semibold text-amber-700';
        return;
    }
    const filaManual = filas.find((fila) => fila.querySelector('[data-field="modo"]').value !== 'automatico');
    if (filaManual) {
        mensaje.textContent = 'Para repetir simulaciones aleatorias, cambia a modo automático todos los dispositivos visibles.';
        mensaje.className = 'text-sm font-semibold text-amber-700';
        filaManual.querySelector('[data-field="modo"]').focus();
        return;
    }

    const restaurarControles = bloquearControlesSimulacion();
    let completadas = 0;
    boton.textContent = `Simulando 0/${cantidad}...`;
    mensaje.textContent = 'Preparando el primer lote de simulación...';
    mensaje.className = 'text-sm text-slate-600';

    try {
        for (let indice = 0; indice < cantidad; indice++) {
            await cargarEstadisticasActualizadas();
            mensaje.textContent = `Estadísticas actualizadas. Generando tanda ${indice + 1} de ${cantidad}...`;
            const payload = construirPayloadSimulacion({ generarAutomaticos: true });
            await guardarLoteSimulacion(payload);
            completadas++;
            boton.textContent = `Simulando ${completadas}/${cantidad}...`;
            mensaje.textContent = `Tanda ${completadas} de ${cantidad} guardada.`;
        }
        await cargarEstadisticasActualizadas();
        mensaje.textContent = `Se guardaron ${completadas} simulaciones para ${filas.length} dispositivos. Volviendo al monitoreo...`;
        mensaje.className = 'text-sm font-semibold text-emerald-700';
        window.location.href = 'Panel%20de%20control.html?sede=todas';
    } catch (error) {
        const detalle = completadas
            ? ` Se guardaron ${completadas} de ${cantidad} simulaciones; las tandas guardadas permanecen en el historial.`
            : '';
        mensaje.textContent = `${error.message || 'No se pudo completar la simulación.'}${detalle}`;
        mensaje.className = 'text-sm font-semibold text-red-700';
    } finally {
        restaurarControles();
        boton.textContent = 'Simular varias veces';
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
