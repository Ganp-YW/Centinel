const $ = (id) => document.getElementById(id);
const meses = new Set();
const colores = ['#0284c7', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#14b8a6'];
const graficos = {};
const agujaTacometro = {
    id: 'agujaTacometro',
    afterDatasetsDraw(chart) {
        const arco = chart.getDatasetMeta(0).data[0];
        if (!arco) return;

        const valor = Number(chart.data.datasets[0].data[0]);
        const angulo = arco.startAngle + Math.PI * (Math.max(0, Math.min(100, valor)) / 100);
        const radio = arco.outerRadius * 0.78;
        const { ctx } = chart;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(arco.x, arco.y);
        ctx.lineTo(arco.x + Math.cos(angulo) * radio, arco.y + Math.sin(angulo) * radio);
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#0f172a';
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(arco.x, arco.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#0f172a';
        ctx.fill();
        ctx.restore();
    }
};
let datosReporte = null;
let entidadSeleccionada = '';
let solicitudReporte = null;

document.addEventListener('DOMContentLoaded', iniciar);

async function iniciar() {
    try {
        const respuestaSesion = await fetch('../PHP/obtenerSesion.php', { credentials: 'include' });
        const sesion = await respuestaSesion.json();
        if (!sesion.autenticado || !sesion.usuario) {
            window.location.href = '../../index.html';
            return;
        }
        if (sesion.usuario.rol !== 'Gerente') {
            window.location.href = 'Panel%20de%20control.html';
            return;
        }
        $('headerUserName').textContent = `${sesion.usuario.nombre} · Gerente`;
    } catch (error) {
        $('mensajeReporte').textContent = 'No se pudo validar la sesión. Inicia sesión nuevamente.';
        return;
    }

    if (typeof Chart === 'undefined' || !window.jspdf?.jsPDF) {
        $('mensajeReporte').textContent = 'No se pudieron cargar las librerías de gráficos/PDF. Verifica la conexión a internet.';
        return;
    }

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
    $('btnCerrarSesion').addEventListener('click', cerrarSesion);
    cargarReporte();
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
    const mes = obtenerMesActivo();
    const registro = datosReporte?.datos?.[mes];
    if (!registro) return;
    const valores = registro.latencia_promedio.map(Number).filter(Number.isFinite);
    const promedio = valores.length ? valores.reduce((total, valor) => total + valor, 0) / valores.length : 0;
    const valorGrafico = Math.min(100, Math.max(0, promedio));
    $('valorLatencia').textContent = `${promedio.toFixed(1)} ms`;
    $('subtituloLatencia').textContent = `Promedio de ${registro.labels.length} ${datosReporte.tipo === 'global' ? 'sedes' : 'dispositivos'} · ${mes}`;

    reemplazarGrafico('latencia', $('graficoLatencia'), {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [valorGrafico, 100 - valorGrafico],
                backgroundColor: [promedio <= 30 ? '#10b981' : promedio <= 60 ? '#f59e0b' : '#ef4444', '#e2e8f0'],
                borderWidth: 0,
                circumference: 180,
                rotation: 270
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '78%', rotation: 270, circumference: 180, plugins: { legend: { display: false }, tooltip: { enabled: false } } },
        plugins: [agujaTacometro]
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
