const contenedorNotificaciones = document.getElementById('notificacionesRoot');

if (contenedorNotificaciones) {
    contenedorNotificaciones.innerHTML = `
        <div class="relative">
            <button id="btnNotificaciones" type="button" aria-expanded="false" aria-controls="panelNotificaciones"
                class="relative inline-flex h-10 items-center gap-2 rounded-lg border border-slate-600 px-3 text-sm text-slate-200 transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400">
                <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 12a2 2 0 0 0 4 0"/>
                </svg>
                <span class="hidden sm:inline">Notificaciones</span>
                <span id="contadorNotificaciones" class="hidden min-w-5 rounded-full bg-red-600 px-1.5 py-0.5 text-center text-xs font-bold leading-4 text-white"></span>
            </button>
            <section id="panelNotificaciones" class="absolute right-0 z-50 mt-2 hidden w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-800 shadow-xl"
                aria-label="Notificaciones">
                <div class="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <h2 class="font-bold">Notificaciones</h2>
                    <button id="btnMarcarTodasLeidas" type="button" class="text-xs font-semibold text-sky-700 hover:text-sky-900">Marcar todas leídas</button>
                </div>
                <div id="listaNotificaciones" class="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    <p class="px-4 py-6 text-center text-sm text-slate-500">Cargando...</p>
                </div>
            </section>
        </div>`;

    const boton = document.getElementById('btnNotificaciones');
    const panel = document.getElementById('panelNotificaciones');
    const lista = document.getElementById('listaNotificaciones');
    const contador = document.getElementById('contadorNotificaciones');
    const botonTodasLeidas = document.getElementById('btnMarcarTodasLeidas');

    const escaparHTML = (valor) => String(valor ?? '').replace(/[&<>"']/g, (caracter) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[caracter]);

    async function cargarNotificaciones() {
        try {
            const respuesta = await fetch('../PHP/notificaciones.php', { credentials: 'include', cache: 'no-store' });
            const datos = await respuesta.json();
            if (!respuesta.ok || !datos.success) {
                throw new Error(datos.mensaje || 'No se pudieron cargar las notificaciones.');
            }
            const pendientes = Number(datos.pendientes) || 0;
            contador.textContent = pendientes > 99 ? '99+' : String(pendientes);
            contador.classList.toggle('hidden', pendientes === 0);
            boton.setAttribute('aria-label', `Notificaciones${pendientes ? `, ${pendientes} pendientes` : ''}`);
            lista.innerHTML = datos.notificaciones.length
                ? datos.notificaciones.map((notificacion) => `
                    <button type="button" data-notificacion-id="${Number(notificacion.id_notificacion)}"
                        data-leida="${notificacion.fecha_leida ? 'true' : 'false'}"
                        class="block w-full px-4 py-3 text-left transition hover:bg-slate-50 ${notificacion.fecha_leida ? '' : 'bg-red-50/60'}">
                        <span class="flex items-start gap-2">
                            ${notificacion.fecha_leida ? '' : '<span class="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red-600" aria-label="Pendiente"></span>'}
                            <span class="min-w-0 flex-1">
                                <span class="block text-sm ${notificacion.fecha_leida ? 'text-slate-600' : 'font-semibold text-slate-900'}">${escaparHTML(notificacion.mensaje)}</span>
                                <span class="mt-1 block text-xs text-slate-500">${escaparHTML(notificacion.fecha_creacion)}</span>
                            </span>
                        </span>
                    </button>`).join('')
                : '<p class="px-4 py-6 text-center text-sm text-slate-500">No tienes notificaciones.</p>';
            botonTodasLeidas.classList.toggle('hidden', pendientes === 0);
        } catch (error) {
            lista.innerHTML = `<p class="px-4 py-6 text-center text-sm text-red-700">${escaparHTML(error.message)}</p>`;
        }
    }

    async function marcarLeidas(payload) {
        const respuesta = await fetch('../PHP/notificaciones.php', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const datos = await respuesta.json();
        if (!respuesta.ok || !datos.success) {
            throw new Error(datos.mensaje || 'No se pudieron actualizar las notificaciones.');
        }
    }

    boton.addEventListener('click', () => {
        const abierto = boton.getAttribute('aria-expanded') === 'true';
        boton.setAttribute('aria-expanded', String(!abierto));
        panel.classList.toggle('hidden', abierto);
        if (!abierto) cargarNotificaciones();
    });

    lista.addEventListener('click', async (evento) => {
        const notificacion = evento.target.closest('[data-notificacion-id]');
        if (!notificacion) return;
        try {
            if (notificacion.dataset.leida !== 'true') {
                await marcarLeidas({ accion: 'marcar_leida', id_notificacion: Number(notificacion.dataset.notificacionId) });
            }
            window.location.href = 'reportes.html#anomalias';
        } catch (error) {
            lista.insertAdjacentHTML('afterbegin', `<p role="alert" class="px-4 py-2 text-sm text-red-700">${escaparHTML(error.message)}</p>`);
        }
    });

    botonTodasLeidas.addEventListener('click', async () => {
        try {
            await marcarLeidas({ accion: 'marcar_todas_leidas' });
            await cargarNotificaciones();
        } catch (error) {
            lista.insertAdjacentHTML('afterbegin', `<p role="alert" class="px-4 py-2 text-sm text-red-700">${escaparHTML(error.message)}</p>`);
        }
    });

    document.addEventListener('click', (evento) => {
        if (!contenedorNotificaciones.contains(evento.target)) {
            panel.classList.add('hidden');
            boton.setAttribute('aria-expanded', 'false');
        }
    });

    cargarNotificaciones();
    window.setInterval(() => {
        if (!document.hidden) cargarNotificaciones();
    }, 60000);
}
