const $ = (id) => document.getElementById(id);
const meses = new Set();
const colores = ['#0284c7', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#14b8a6'];
const graficos = {};
let datosReporte = null;
let entidadSeleccionada = '';
let solicitudReporte = null;
let solicitudAnalisis = null;
let rolActivo = '';
let analisisInicializado = false;

document.addEventListener('DOMContentLoaded', iniciar);

async function iniciar() {
    try {
        const respuestaSesion = await fetch('../PHP/obtenerSesion.php', { credentials: 'include' });
        const sesion = await respuestaSesion.json();
        if (!sesion.autenticado || !sesion.usuario) {
            window.location.href = '../../index.html';
            return;
        }
        rolActivo = sesion.usuario.rol === 'Tecnico' || sesion.usuario.rol === 'Técnico'
            ? 'Técnico'
            : sesion.usuario.rol;
        if (!['Gerente', 'Técnico'].includes(rolActivo)) {
            window.location.href = 'Panel%20de%20control.html';
            return;
        }
        $('headerUserName').textContent = `${sesion.usuario.nombre} · ${rolActivo}`;
        $('badgeRol').textContent = rolActivo === 'Gerente' ? 'Gerencia' : rolActivo;
        $('headerAvatarImg').src = rolActivo === 'Gerente' ? '../assets/avatar_gerente.svg' : '../assets/avatar_tecnico.svg';
        $('headerAvatarImg').alt = `Avatar ${rolActivo}`;
    } catch (error) {
        $('mensajeReporte').textContent = 'No se pudo validar la sesión. Inicia sesión nuevamente.';
        return;
    }

    const esGerente = rolActivo === 'Gerente';
    $('tabDashboard').classList.toggle('hidden', !esGerente);
    $('btnExportarPDF').hidden = !esGerente;
    const hashInicial = window.location.hash;
    seleccionarPestana(esGerente && hashInicial !== '#anomalias' ? 'dashboard' : 'anomalias');
    document.querySelectorAll('[data-report-tab]').forEach((boton) => {
        boton.addEventListener('click', () => seleccionarPestana(boton.dataset.reportTab));
    });
    $('btnCerrarSesion').addEventListener('click', cerrarSesion);

    if (esGerente) {
        inicializarAnalisis();
        if (typeof Chart === 'undefined' || !window.jspdf?.jsPDF) {
            $('mensajeReporte').textContent = 'No se pudieron cargar las librerías de gráficos/PDF. El registro de anomalías sigue disponible.';
            $('mensajeReporte').className = 'ml-auto text-sm font-semibold text-amber-700';
        } else {
            const ahora = new Date();
            const mesActual = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;
            $('mesComparacion').value = mesActual;
            agregarMes(mesActual);

            $('btnAgregarMes').addEventListener('click', () => agregarMes($('mesComparacion').value));
            $('btnActualizar').addEventListener('click', cargarReporte);
            $('tipoReporte').addEventListener('change', () => {
                $('campoSede').classList.toggle('hidden', $('tipoReporte').value === 'global');
                cargarReporte();
            });
            $('sedeReporte').addEventListener('change', cargarReporte);
            $('entidadDisponibilidad').addEventListener('change', (evento) => {
                entidadSeleccionada = evento.target.value;
                actualizarDisponibilidad();
            });
            $('btnExportarPDF').addEventListener('click', exportarPDF);
        }
    }
}

function seleccionarPestana(nombre) {
    const activa = nombre === 'dashboard' && rolActivo === 'Gerente' ? 'dashboard' : 'anomalias';
    window.history.replaceState(null, '', `#${activa}`);
    const esDashboard = activa === 'dashboard';
    $('panelDashboard').classList.toggle('hidden', !esDashboard);
    $('panelAnomalias').classList.toggle('hidden', esDashboard);
    $('tabDashboard').setAttribute('aria-selected', String(esDashboard));
    $('tabAnomalias').setAttribute('aria-selected', String(!esDashboard));
    $('tabDashboard').classList.toggle('border-sky-700', esDashboard);
    $('tabDashboard').classList.toggle('text-sky-800', esDashboard);
    $('tabDashboard').classList.toggle('border-transparent', !esDashboard);
    $('tabDashboard').classList.toggle('text-slate-500', !esDashboard);
    $('tabAnomalias').classList.toggle('border-sky-700', !esDashboard);
    $('tabAnomalias').classList.toggle('text-sky-800', !esDashboard);
    $('tabAnomalias').classList.toggle('border-transparent', esDashboard);
    $('tabAnomalias').classList.toggle('text-slate-500', esDashboard);
}

const ventanasAnalisisMs = {
    anio: 365 * 24 * 60 * 60 * 1000,
    mes: 30 * 24 * 60 * 60 * 1000,
    semana: 7 * 24 * 60 * 60 * 1000,
    dia: 24 * 60 * 60 * 1000,
    hora: 60 * 60 * 1000
};

function fechaHoraLocal(fecha) {
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    const hora = String(fecha.getHours()).padStart(2, '0');
    const minuto = String(fecha.getMinutes()).padStart(2, '0');
    const segundo = String(fecha.getSeconds()).padStart(2, '0');
    return `${anio}-${mes}-${dia}T${hora}:${minuto}:${segundo}`;
}

function establecerRangoAnalisis() {
    const ahora = new Date();
    ahora.setMilliseconds(0);
    const granularidad = $('granularidadAnalisis').value;
    const inicioVentana = new Date(ahora.getTime() - ventanasAnalisisMs[granularidad]);
    const desde = fechaHoraLocal(inicioVentana);
    const hasta = fechaHoraLocal(ahora);
    for (const campo of [$('desdeAnalisis'), $('hastaAnalisis')]) {
        campo.min = desde;
        campo.max = hasta;
    }
    $('desdeAnalisis').value = desde;
    $('hastaAnalisis').value = hasta;
}

function inicializarAnalisis() {
    if (analisisInicializado) return;
    analisisInicializado = true;
    if (typeof Chart === 'undefined') {
        $('mensajeAnalisis').textContent = 'No se pudo cargar la librería de gráficos.';
        $('mensajeAnalisis').className = 'text-sm font-semibold text-red-700';
        return;
    }
    establecerRangoAnalisis();
    $('granularidadAnalisis').addEventListener('change', () => {
        establecerRangoAnalisis();
        cargarAnalisis();
    });
    $('sedeAnalisis').addEventListener('change', filtrarDispositivosAnalisis);
    $('btnActualizarAnalisis').addEventListener('click', () => {
        establecerRangoAnalisis();
        cargarAnalisis();
    });
    cargarAnalisis();
}

async function cargarAnalisis() {
    const parametros = new URLSearchParams({
        granularidad: $('granularidadAnalisis').value,
        id_sede: $('sedeAnalisis').value,
        id_dispositivo: $('dispositivoAnalisis').value
    });
    solicitudAnalisis?.abort();
    const solicitudActual = new AbortController();
    solicitudAnalisis = solicitudActual;
    const boton = $('btnActualizarAnalisis');
    boton.disabled = true;
    $('mensajeAnalisis').textContent = 'Calculando estadísticas del historial...';
    $('mensajeAnalisis').className = 'text-sm text-slate-500';

    try {
        const respuesta = await fetch(`../PHP/obtenerAnalisisSimulacion.php?${parametros}`, {
            credentials: 'include',
            cache: 'no-store',
            signal: solicitudActual.signal
        });
        const datos = await respuesta.json();
        if (!respuesta.ok || !datos.success) {
            throw new Error(datos.mensaje || 'No se pudo calcular el análisis.');
        }
        $('desdeAnalisis').value = datos.desde.replace(' ', 'T');
        $('hastaAnalisis').value = datos.hasta.replace(' ', 'T');
        actualizarOpcionesAnalisis(datos.opciones);
        actualizarResumenAnalisis(datos.periodos);
        actualizarGraficosAnalisis(datos.periodos, datos.muestras || [], datos.granularidad_intervalo);
        const origen = datos.origen === 'memoria' ? 'memoria de esta sesión; no está guardado en la base de datos' : 'base de datos';
        const totalMediciones = datos.periodos.reduce((total, periodo) => total + periodo.total, 0);
        const detalleSerie = totalMediciones && datos.periodos.length === 1
            ? ` · ${datos.muestras.length} mediciones graficadas en orden cronológico${datos.muestras_limitadas ? ' (máximo 1000)' : ''}`
            : '';
        $('mensajeAnalisis').textContent = totalMediciones
            ? `${datos.periodos.length} intervalos${detalleSerie} · mediciones de ${origen}.`
            : `No hay mediciones para estos filtros y fechas · origen: ${origen}.`;
        $('mensajeAnalisis').className = `text-sm ${datos.origen === 'memoria' ? 'text-amber-700' : 'text-emerald-700'}`;
    } catch (error) {
        if (error.name === 'AbortError') return;
        $('mensajeAnalisis').textContent = error.message || 'No se pudo cargar el análisis.';
        $('mensajeAnalisis').className = 'text-sm font-semibold text-red-700';
    } finally {
        if (solicitudAnalisis === solicitudActual) boton.disabled = false;
    }
}

function actualizarOpcionesAnalisis(opciones = {}) {
    const sedeActual = $('sedeAnalisis').value;
    const sedes = opciones.sedes || [];
    $('sedeAnalisis').innerHTML = '<option value="">Todas las sedes</option>' + sedes.map((sede) =>
        `<option value="${escaparHTML(sede.id)}">${escaparHTML(sede.nombre)}</option>`
    ).join('');
    if (sedes.some((sede) => String(sede.id) === sedeActual)) $('sedeAnalisis').value = sedeActual;

    const dispositivoActual = $('dispositivoAnalisis').value;
    $('dispositivoAnalisis').dataset.opciones = JSON.stringify(opciones.dispositivos || []);
    filtrarDispositivosAnalisis();
    if ([...$('dispositivoAnalisis').options].some((opcion) => opcion.value === dispositivoActual)) {
        $('dispositivoAnalisis').value = dispositivoActual;
    }

}

function filtrarDispositivosAnalisis() {
    let dispositivos = [];
    try {
        dispositivos = JSON.parse($('dispositivoAnalisis').dataset.opciones || '[]');
    } catch (error) {
        console.error('No se pudieron leer las opciones de dispositivos del análisis.', error);
    }
    const sede = $('sedeAnalisis').value;
    const actual = $('dispositivoAnalisis').value;
    const visibles = dispositivos.filter((dispositivo) => !sede || String(dispositivo.id_sede ?? '') === sede);
    $('dispositivoAnalisis').innerHTML = '<option value="">Todos los dispositivos</option>' + visibles.map((dispositivo) =>
        `<option value="${escaparHTML(dispositivo.id)}">${escaparHTML(dispositivo.nombre)}${dispositivo.sede ? ` · ${escaparHTML(dispositivo.sede)}` : ''}</option>`
    ).join('');
    if (visibles.some((dispositivo) => String(dispositivo.id) === actual)) $('dispositivoAnalisis').value = actual;
}

function actualizarResumenAnalisis(periodos) {
    const total = periodos.reduce((suma, periodo) => suma + periodo.total, 0);
    const conectados = periodos.reduce((suma, periodo) => suma + periodo.conectados, 0);
    $('totalMedicionesAnalisis').textContent = total.toLocaleString('es');
    $('probabilidadAnalisis').textContent = total ? `${(100 * conectados / total).toFixed(1)}%` : '—';
    $('automaticasAnalisis').textContent = periodos.reduce((suma, periodo) => suma + periodo.automaticos, 0).toLocaleString('es');
    $('manualesAnalisis').textContent = periodos.reduce((suma, periodo) => suma + periodo.manuales, 0).toLocaleString('es');
}

function actualizarGraficosAnalisis(periodos, muestras, granularidadIntervalo) {
    const usarSerieMuestras = periodos.length === 1 && muestras.length > 0;
    const puntos = usarSerieMuestras ? crearIntervalosGraficos(muestras) : periodos;
    const etiquetas = usarSerieMuestras ? puntos.map((punto) => punto.etiqueta) : puntos.map((punto) => punto.periodo);
    const etiquetasGranularidad = { mes: 'mes', dia: 'día', hora: 'hora', minuto: '5 minutos' };
    const textoPeriodo = usarSerieMuestras
        ? 'Por bloque cronológico de mediciones'
        : `Por intervalo de ${etiquetasGranularidad[granularidadIntervalo] || 'tiempo'}`;

    $('graficoProbabilidadAnalisis').parentElement.parentElement.querySelector('p').textContent =
        `${textoPeriodo}: barras con la proporción real y línea Beta suavizada en ventanas de 3 bloques.`;
    $('graficoLatenciaAnalisis').parentElement.parentElement.querySelector('p').textContent =
        `${textoPeriodo}: media por bloque y mediana móvil; los periodos sin datos quedan vacíos.`;
    $('graficoAnchoBandaAnalisis').parentElement.parentElement.querySelector('p').textContent =
        `${textoPeriodo}: media por bloque y mediana móvil; los periodos sin datos quedan vacíos.`;

    const nConectividad = puntos.map((punto) => punto.total ?? punto.n ?? 0);
    const conectados = puntos.map((punto) => punto.conectados ?? 0);
    const probabilidadSuavizada = puntos.map((_, indice) => {
        if (!nConectividad[indice]) return null;
        const inicio = Math.max(0, indice - 1);
        const fin = Math.min(puntos.length - 1, indice + 1);
        const exitos = conectados.slice(inicio, fin + 1).reduce((suma, cantidad) => suma + cantidad, 0);
        const muestra = nConectividad.slice(inicio, fin + 1).reduce((suma, cantidad) => suma + cantidad, 0);
        return muestra ? 100 * (exitos + 1) / (muestra + 2) : null;
    });
    reemplazarGrafico('analisisProbabilidad', $('graficoProbabilidadAnalisis'), {
        type: 'bar',
        data: {
            labels: etiquetas,
            datasets: [{
                label: 'Probabilidad observada de conexión (%)',
                data: puntos.map((punto) => punto.total === 0
                    ? null
                    : 100 * (punto.probabilidad_conectado ?? punto.probabilidad)),
                backgroundColor: 'rgba(5, 150, 105, 0.72)',
                borderColor: '#047857',
                borderWidth: 1,
                borderRadius: 4,
                maxBarThickness: 42
            }, {
                type: 'line',
                label: 'Tendencia Beta suavizada (3 bloques)',
                data: probabilidadSuavizada,
                borderColor: '#0f172a',
                backgroundColor: '#0f172a',
                borderWidth: 2,
                pointRadius: 0,
                tension: 0.35
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { grid: { display: false }, ticks: { autoSkip: true, maxTicksLimit: 12 } },
                y: { min: 0, max: 100, title: { display: true, text: 'Conexión exitosa (%)' } }
            },
            plugins: {
                legend: { position: 'bottom' },
                tooltip: {
                    callbacks: {
                        title: (items) => usarSerieMuestras ? puntos[items[0]?.dataIndex]?.rango : items[0]?.label,
                        afterLabel: (item) => `${puntos[item.dataIndex].conectados} de ${nConectividad[item.dataIndex]} mediciones conectadas`
                    }
                }
            }
        }
    });

    crearGraficoSerieVariable(
        'analisisLatencia',
        'graficoLatenciaAnalisis',
        etiquetas,
        puntos,
        usarSerieMuestras ? 'media_latencia' : 'media_latencia',
        usarSerieMuestras ? 'n_latencia' : 'n_latencia',
        'Latencia media (ms)',
        '#0284c7',
        usarSerieMuestras,
        false
    );
    crearGraficoSerieVariable(
        'analisisAnchoBanda',
        'graficoAnchoBandaAnalisis',
        etiquetas,
        puntos,
        'media_ancho_banda',
        'n_ancho_banda',
        'Ancho de banda medio (Mbps)',
        '#8b5cf6',
        usarSerieMuestras,
        true
    );
}

function crearIntervalosGraficos(muestras, maxIntervalos = 12) {
    const tamanoIntervalo = Math.ceil(muestras.length / maxIntervalos);
    const intervalos = [];
    for (let inicio = 0; inicio < muestras.length; inicio += tamanoIntervalo) {
        const lote = muestras.slice(inicio, inicio + tamanoIntervalo);
        const conectadas = lote.filter((muestra) => muestra.conectividad === 1);
        const latencias = conectadas.map((muestra) => muestra.latencia).filter((valor) => valor > 0);
        const anchos = conectadas.map((muestra) => muestra.ancho_banda).filter((valor) => valor > 0);
        const fechaInicio = lote[0].fecha_registro;
        const fechaFin = lote[lote.length - 1].fecha_registro;
        const mismoDia = fechaInicio.slice(0, 10) === fechaFin.slice(0, 10);
        const horaInicio = fechaInicio.slice(11, 16);
        const horaFin = fechaFin.slice(11, 16);
        intervalos.push({
            etiqueta: mismoDia ? `${horaInicio}–${horaFin}` : `${fechaInicio.slice(5, 16)}–${fechaFin.slice(5, 16)}`,
            rango: `${fechaInicio} – ${fechaFin}`,
            n: lote.length,
            conectados: conectadas.length,
            probabilidad: conectadas.length / lote.length,
            n_latencia: latencias.length,
            media_latencia: latencias.length ? latencias.reduce((suma, valor) => suma + valor, 0) / latencias.length : null,
            n_ancho_banda: anchos.length,
            media_ancho_banda: anchos.length ? anchos.reduce((suma, valor) => suma + valor, 0) / anchos.length : null
        });
    }
    return intervalos;
}

function crearGraficoSerieVariable(clave, canvasId, etiquetas, puntos, campoMedia, campoMuestra, titulo, color, usarSerieMuestras, permitirEscalaLogaritmica) {
    const observados = puntos.map((punto) => punto[campoMedia]);
    const tendencia = observados.map((_, indice) => {
        const inicio = Math.max(0, indice - 1);
        const fin = Math.min(observados.length - 1, indice + 1);
        const valores = observados.slice(inicio, fin + 1)
            .filter((valor) => Number.isFinite(valor) && valor > 0)
            .sort((a, b) => a - b);
        if (Number.isFinite(observados[indice]) && observados[indice] > 0) {
            return valores[Math.floor(valores.length / 2)];
        }
        const anterior = observados[indice - 1];
        const siguiente = observados[indice + 1];
        return null;
    });
    const positivos = observados.filter((valor) => Number.isFinite(valor) && valor > 0).sort((a, b) => a - b);
    const mediana = positivos.length ? positivos[Math.floor(positivos.length / 2)] : 0;
    const maximo = positivos.at(-1) ?? 0;
    const usarLogaritmica = permitirEscalaLogaritmica && positivos.length > 1 && mediana > 0 && maximo / mediana >= 10;
    const escala = {
        beginAtZero: !usarLogaritmica,
        ...(usarLogaritmica ? {
            type: 'logarithmic',
            min: Math.max(Number.MIN_VALUE, positivos[0] / 1.5),
            max: maximo * 1.5,
            ticks: {
                callback: (valor) => new Intl.NumberFormat('es', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(valor))
            }
        } : {})
    };
    if (usarLogaritmica) {
        $('graficoAnchoBandaAnalisis').parentElement.parentElement.querySelector('p').textContent =
            `${usarSerieMuestras ? 'Por bloque cronológico de mediciones' : 'Por intervalo seleccionado'}: escala logarítmica para distinguir valores habituales y extremos; línea de mediana móvil robusta.`;
    }

    reemplazarGrafico(clave, $(canvasId), {
        type: 'line',
        data: {
            labels: etiquetas,
            datasets: [{
                label: titulo,
                data: observados,
                borderColor: color,
                backgroundColor: `${color}22`,
                borderWidth: 2,
                pointRadius: 2,
                pointHoverRadius: 5,
                tension: 0.3,
                spanGaps: false,
                fill: false
            }, {
                type: 'line',
                label: 'Tendencia robusta (mediana móvil de 3 bloques)',
                data: tendencia,
                borderColor: '#f59e0b',
                backgroundColor: '#f59e0b',
                borderWidth: 3,
                pointRadius: 1,
                pointHoverRadius: 5,
                tension: 0.35,
                spanGaps: false,
                borderDash: [6, 4]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { autoSkip: true, maxTicksLimit: 12, maxRotation: 35, minRotation: 0 }
                },
                y: { ...escala, title: { display: true, text: titulo.replace('media', '').trim() } }
            },
            plugins: {
                legend: { position: 'bottom' },
                tooltip: {
                    callbacks: {
                        title: (items) => usarSerieMuestras ? puntos[items[0]?.dataIndex]?.rango : items[0]?.label,
                        afterLabel: (item) => `n = ${puntos[item.dataIndex][campoMuestra]}`
                    }
                }
            }
        }
    });
}

function crearGraficoEstadisticoAnalisis(clave, canvasId, etiquetas, periodos, campoMedia, campoDesviacion, unidad, color) {
    reemplazarGrafico(clave, $(canvasId), {
        type: 'line',
        data: {
            labels: etiquetas,
            datasets: [
                {
                    label: `Media (${unidad})`,
                    data: periodos.map((periodo) => periodo[campoMedia]),
                    borderColor: color,
                    backgroundColor: color,
                    tension: 0.25
                },
                {
                    label: `Desviación estándar (${unidad})`,
                    data: periodos.map((periodo) => periodo[campoDesviacion]),
                    borderColor: '#f59e0b',
                    backgroundColor: '#f59e0b',
                    borderDash: [6, 4],
                    tension: 0.25
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: { grid: { display: false } },
                y: { beginAtZero: true, title: { display: true, text: unidad } }
            },
            plugins: {
                legend: { position: 'bottom' },
                tooltip: {
                    callbacks: {
                        afterBody: (items) => {
                            const periodo = periodos[items[0]?.dataIndex];
                            const muestra = campoMedia === 'media_latencia' ? periodo?.n_latencia : periodo?.n_ancho_banda;
                            return `n = ${muestra ?? 0}`;
                        }
                    }
                }
            }
        }
    });
}
function agregarMes(mes) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) {
        $('mensajeReporte').textContent = 'Selecciona un mes válido.';
        return;
    }
    meses.add(mes);
    renderizarMeses();
    cargarReporte();
}

function renderizarMeses() {
    const contenedor = $('mesesSeleccionados');
    contenedor.innerHTML = [...meses].sort().map((mes) => `
        <span class="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-800">
            ${escaparHTML(mes)}
            <button type="button" data-quitar-mes="${escaparHTML(mes)}" aria-label="Quitar ${escaparHTML(mes)}" class="rounded-full text-sky-700 hover:text-red-700">×</button>
        </span>`).join('');
    contenedor.querySelectorAll('[data-quitar-mes]').forEach((boton) => {
        boton.addEventListener('click', () => {
            if (meses.size === 1) {
                $('mensajeReporte').textContent = 'Debe permanecer al menos un mes seleccionado.';
                return;
            }
            meses.delete(boton.dataset.quitarMes);
            renderizarMeses();
            cargarReporte();
        });
    });
}

function escaparHTML(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, (caracter) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[caracter]);
}

async function cargarReporte() {
    if (!meses.size) return;
    solicitudReporte?.abort();
    solicitudReporte = new AbortController();
    const mensaje = $('mensajeReporte');
    mensaje.textContent = 'Consultando métricas...';
    const parametros = new URLSearchParams({
        tipo: $('tipoReporte').value,
        sede: $('sedeReporte').value,
        meses: [...meses].sort().join(',')
    });

    try {
        const respuesta = await fetch(`../PHP/obtenerReportes.php?${parametros}`, {
            credentials: 'include',
            signal: solicitudReporte.signal
        });
        const datos = await respuesta.json();
        if (!respuesta.ok || !datos.success || !datos.datos) {
            throw new Error(datos.mensaje || 'El servidor no pudo preparar el reporte.');
        }
        datosReporte = datos;
        mensaje.textContent = `Reporte ${datos.origen === 'memoria' ? 'de demostración' : 'de base de datos'} actualizado · ${datos.meses.join(', ')}`;
        mensaje.className = `ml-auto text-sm ${datos.origen === 'memoria' ? 'text-amber-700' : 'text-emerald-700'}`;
        actualizarEntidades();
        actualizarGraficos();
    } catch (error) {
        if (error.name === 'AbortError') return;
        mensaje.textContent = error.message || 'No se pudo cargar el reporte.';
        mensaje.className = 'ml-auto text-sm font-semibold text-red-700';
    }
}

function obtenerMesActivo() {
    const disponibles = Object.keys(datosReporte?.datos || {}).sort();
    return disponibles[disponibles.length - 1];
}

function actualizarEntidades() {
    const mes = obtenerMesActivo();
    const registro = datosReporte?.datos?.[mes];
    if (!registro) return;

    const selector = $('entidadDisponibilidad');
    const opciones = registro.labels.map((etiqueta) => `<option value="${escaparHTML(etiqueta)}">${escaparHTML(etiqueta)}</option>`).join('');
    selector.innerHTML = opciones;
    if (!registro.labels.includes(entidadSeleccionada)) entidadSeleccionada = registro.labels[0] || '';
    selector.value = entidadSeleccionada;
}

function actualizarGraficos() {
    actualizarDisponibilidad();
    actualizarLatencia();
    actualizarConsumo();
}

function actualizarDisponibilidad() {
    const mes = obtenerMesActivo();
    const registro = datosReporte?.datos?.[mes];
    if (!registro) return;
    const indice = registro.labels.indexOf(entidadSeleccionada);
    const disponibilidad = indice >= 0 ? Number(registro.disponibilidad[indice]) : 0;
    $('subtituloDisponibilidad').textContent = `${entidadSeleccionada || 'Sin datos'} · ${mes}`;
    $('listaDisponibilidad').innerHTML = registro.labels.map((etiqueta, posicion) => {
        const porcentaje = Number(registro.disponibilidad[posicion] || 0);
        return `<div class="flex items-center justify-between gap-3 text-xs">
            <span class="truncate text-slate-600">${escaparHTML(etiqueta)}</span>
            <span class="shrink-0 font-bold ${porcentaje >= 95 ? 'text-emerald-700' : 'text-amber-700'}">${porcentaje.toFixed(1)}%</span>
        </div>`;
    }).join('');

    reemplazarGrafico('disponibilidad', $('graficoDisponibilidad'), {
        type: 'pie',
        data: {
            labels: ['Conectado', 'Desconectado'],
            datasets: [{ data: [disponibilidad, Math.max(0, 100 - disponibilidad)], backgroundColor: ['#10b981', '#e2e8f0'], borderWidth: 0 }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${Number(ctx.raw).toFixed(1)}%` } } }
        }
    });
    actualizarEvolucion();
}

function actualizarLatencia() {
    const mesesOrdenados = Object.keys(datosReporte?.datos || {}).sort();
    const primera = datosReporte?.datos?.[mesesOrdenados[0]];
    if (!primera) return;

    const etiquetas = primera.labels || [];
    $('subtituloLatencia').textContent = `Comparativa de ${etiquetas.length} ${datosReporte.tipo === 'global' ? 'sedes' : 'dispositivos'} · ${mesesOrdenados.join(', ')}`;

    const datasets = mesesOrdenados.map((mes, indice) => ({
        label: mes,
        data: etiquetas.map((etiqueta) => {
            const reporteMes = datosReporte.datos[mes];
            const posicion = reporteMes.labels.indexOf(etiqueta);
            return posicion >= 0 ? Number(reporteMes.latencia_promedio[posicion]) : 0;
        }),
        backgroundColor: colores[indice % colores.length],
        borderRadius: 5
    }));

    reemplazarGrafico('latencia', $('graficoLatencia'), {
        type: 'bar',
        data: { labels: etiquetas, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { grid: { display: false }, ticks: { maxRotation: 45, minRotation: 0 } },
                y: { beginAtZero: true, title: { display: true, text: 'Latencia (ms)' } }
            },
            plugins: { legend: { position: 'bottom' } }
        }
    });
}

function actualizarConsumo() {
    const mesesOrdenados = Object.keys(datosReporte?.datos || {}).sort();
    const primera = datosReporte.datos[mesesOrdenados[0]];
    const etiquetas = primera?.labels || [];
    const datasets = mesesOrdenados.map((mes, indice) => ({
        label: mes,
        data: etiquetas.map((etiqueta) => {
            const reporteMes = datosReporte.datos[mes];
            const posicion = reporteMes.labels.indexOf(etiqueta);
            return posicion >= 0 ? Number(reporteMes.consumo_total[posicion]) : 0;
        }),
        backgroundColor: colores[indice % colores.length],
        borderRadius: 5
    }));

    reemplazarGrafico('consumo', $('graficoConsumo'), {
        type: 'bar',
        data: { labels: etiquetas, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { grid: { display: false }, ticks: { maxRotation: 45, minRotation: 0 } },
                y: { beginAtZero: true, title: { display: true, text: 'Mbps acumulados' } }
            },
            plugins: { legend: { position: 'bottom' } }
        }
    });
}

function actualizarEvolucion() {
    const mesesOrdenados = Object.keys(datosReporte?.datos || {}).sort();
    const disponibilidad = [];
    const latencia = [];
    for (const mes of mesesOrdenados) {
        const registro = datosReporte.datos[mes];
        const indice = registro.labels.indexOf(entidadSeleccionada);
        disponibilidad.push(indice >= 0 ? Number(registro.disponibilidad[indice]) : null);
        latencia.push(indice >= 0 ? Number(registro.latencia_promedio[indice]) : null);
    }
    $('entidadEvolucion').textContent = entidadSeleccionada;
    reemplazarGrafico('evolucion', $('graficoEvolucion'), {
        type: 'line',
        data: {
            labels: mesesOrdenados,
            datasets: [
                { label: 'Disponibilidad (%)', data: disponibilidad, borderColor: '#0284c7', backgroundColor: '#0284c7', yAxisID: 'y', tension: 0.3 },
                { label: 'Latencia (ms)', data: latencia, borderColor: '#f59e0b', backgroundColor: '#f59e0b', yAxisID: 'y1', tension: 0.3 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                y: { beginAtZero: true, max: 100, title: { display: true, text: 'Disponibilidad (%)' } },
                y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'Latencia (ms)' } }
            },
            plugins: { legend: { position: 'bottom' } }
        }
    });
}

function reemplazarGrafico(clave, canvas, config) {
    if (graficos[clave]) graficos[clave].destroy();
    graficos[clave] = new Chart(canvas, config);
}

function exportarPDF() {
    const boton = $('btnExportarPDF');
    const textoOriginal = boton.textContent.trim();
    boton.disabled = true;
    boton.textContent = 'Generando PDF...';
    try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const anchoPagina = pdf.internal.pageSize.getWidth();
        const mesesReporte = Object.keys(datosReporte?.datos || {}).sort();
        const titulo = datosReporte?.tipo === 'global'
            ? 'Comparativo global por sede'
            : `Reporte de sede: ${$('sedeReporte').value}`;
        const margen = 10;
        const espacio = 5;
        const anchoTarjeta = (anchoPagina - margen * 2 - espacio * 2) / 3;
        const tarjetas = [
            { id: 'graficoDisponibilidad', titulo: 'Disponibilidad' },
            { id: 'graficoLatencia', titulo: 'Latencia promedio' },
            { id: 'graficoConsumo', titulo: 'Consumo por entidad' }
        ];

        pdf.setFillColor(248, 250, 252);
        pdf.rect(0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight(), 'F');
        pdf.setTextColor(15, 23, 42);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(18);
        pdf.text('Centinel | Reporte de red', margen, 15);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.setTextColor(71, 85, 105);
        pdf.text(titulo, margen, 22);
        pdf.text(`Periodo: ${mesesReporte.join(', ')}`, margen, 28);

        tarjetas.forEach((tarjeta, indice) => {
            const x = margen + indice * (anchoTarjeta + espacio);
            const y = 34;
            const canvas = $(tarjeta.id);
            pdf.setFillColor(255, 255, 255);
            pdf.setDrawColor(226, 232, 240);
            pdf.roundedRect(x, y, anchoTarjeta, 88, 3, 3, 'FD');
            pdf.setTextColor(15, 23, 42);
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(11);
            pdf.text(tarjeta.titulo, x + 4, y + 8);

            const image = canvas.toDataURL('image/png');
            const proporcion = canvas.width / canvas.height;
            const anchoImagen = anchoTarjeta - 8;
            const altoImagen = Math.min(69, anchoImagen / proporcion);
            const left = x + (anchoTarjeta - anchoImagen) / 2;
            const top = y + 12 + (69 - altoImagen) / 2;
            pdf.addImage(image, 'PNG', left, top, anchoImagen, altoImagen);
        });

        pdf.setFillColor(255, 255, 255);
        pdf.setDrawColor(226, 232, 240);
        pdf.roundedRect(margen, 127, anchoPagina - margen * 2, 72, 3, 3, 'FD');
        pdf.setTextColor(15, 23, 42);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        pdf.text('Evolución mensual de disponibilidad y latencia', margen + 4, 135);
        const evolucion = $('graficoEvolucion');
        pdf.addImage(evolucion.toDataURL('image/png'), 'PNG', margen + 4, 138, anchoPagina - margen * 2 - 8, 56);

        pdf.save(`centinel-reporte-${mesesReporte.at(-1) || 'red'}.pdf`);
    } catch (error) {
        $('mensajeReporte').textContent = `No se pudo exportar el PDF: ${error.message}`;
        $('mensajeReporte').className = 'ml-auto text-sm font-semibold text-red-700';
    } finally {
        boton.disabled = false;
        boton.textContent = textoOriginal || 'Exportar dashboard a PDF';
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