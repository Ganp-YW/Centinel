const sedes = [
    { nombre: 'Todas las sedes', valor: 'todas', badge: 'badgeTotalSedes' },
    { nombre: 'Miranda', valor: 'Miranda', badge: 'badgeMiranda' },
    { nombre: 'Aragua', valor: 'Aragua', badge: 'badgeAragua' },
    { nombre: 'Táchira', valor: 'Táchira', badge: 'badgeTachira' }
];

const enlacesSedes = sedes.map(({ nombre, valor, badge }) => `
    <li>
        <a href="Panel%20de%20control.html?sede=${encodeURIComponent(valor)}" data-sede="${valor}" class="sede-link flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-sky-50 hover:text-sky-700">
            <span>${nombre}</span>
            <span id="${badge}" class="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">—</span>
        </a>
    </li>
`).join('');

const contenedor = document.getElementById('sidebarContainer');
if (contenedor) {
    contenedor.innerHTML = `
        <aside class="flex h-fit w-full shrink-0 flex-col gap-6 rounded-xl border border-gray-200 bg-white p-5 shadow-md md:w-64">
            <div>
                <h2 class="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500">
                    <svg class="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
                    </svg>
                    Monitoreo por sede
                </h2>
                <ul class="flex flex-col gap-1">${enlacesSedes}</ul>
            </div>
            <div class="border-t border-gray-100 pt-4">
                <h2 class="mb-3 text-xs font-bold uppercase tracking-wider text-gray-500">Simulación del servidor</h2>
                <ul class="flex flex-col gap-1 text-sm font-medium">
                    <li><a href="simulacion.html" class="block rounded-lg px-3 py-2 text-gray-700 transition hover:bg-sky-50 hover:text-sky-700">Simulación de red</a></li>
                    <li><a href="historial-simulaciones.html" class="block rounded-lg px-3 py-2 text-gray-700 transition hover:bg-sky-50 hover:text-sky-700">Historial de simulaciones</a></li>
                </ul>
            </div>
            <div id="menuHerramientas" class="hidden border-t border-gray-100 pt-4">
                <h2 class="mb-3 text-xs font-bold uppercase tracking-wider text-gray-500">Reportes</h2>
                <ul class="flex flex-col gap-1 text-sm font-medium">
                    <li><a id="linkReportes" href="reportes.html" class="block rounded-lg px-3 py-2 text-gray-700 transition hover:bg-sky-50 hover:text-sky-700">Reportes</a></li>
                </ul>
            </div>
        </aside>
    `;

    document.querySelectorAll('.sede-link').forEach((link) => {
        const sede = new URL(link.href).searchParams.get('sede');
        if (new URLSearchParams(window.location.search).get('sede') === sede
            || (!new URLSearchParams(window.location.search).has('sede') && sede === 'todas')) {
            link.classList.add('bg-sky-50', 'font-semibold', 'text-sky-700');
        }
    });

    fetch('../PHP/obtenerDispositivos.php')
        .then((respuesta) => {
            if (!respuesta.ok) throw new Error('No fue posible consultar el inventario.');
            return respuesta.json();
        })
        .then((datos) => {
            if (!datos.success || !Array.isArray(datos.dispositivos)) {
                throw new Error(datos.mensaje || 'El servidor devolvió un inventario inválido.');
            }

            const normalizar = (texto) => String(texto ?? '')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase()
                .trim();
            const conteos = {
                badgeTotalSedes: datos.dispositivos.length,
                badgeMiranda: datos.dispositivos.filter((dispositivo) => normalizar(dispositivo.sede) === 'miranda').length,
                badgeAragua: datos.dispositivos.filter((dispositivo) => normalizar(dispositivo.sede) === 'aragua').length,
                badgeTachira: datos.dispositivos.filter((dispositivo) => normalizar(dispositivo.sede) === 'tachira').length
            };

            Object.entries(conteos).forEach(([id, cantidad]) => {
                const badge = document.getElementById(id);
                if (badge) badge.textContent = cantidad;
            });
        })
        .catch((error) => {
            console.error('No se pudieron cargar los contadores del menú lateral:', error);
        });

    fetch('../PHP/obtenerSesion.php', { credentials: 'include' })
        .then((respuesta) => {
            if (!respuesta.ok) throw new Error('No fue posible consultar la sesión.');
            return respuesta.json();
        })
        .then((datos) => {
            const rol = String(datos.usuario?.rol ?? '')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .trim()
                .toLowerCase();
            const menuReportes = document.getElementById('menuHerramientas');
            if (menuReportes) menuReportes.classList.toggle('hidden', !datos.autenticado || !['gerente', 'tecnico'].includes(rol));
            const enlaceReportes = document.getElementById('linkReportes');
            if (enlaceReportes) {
                enlaceReportes.href = rol === 'tecnico' ? 'reportes.html#anomalias' : 'reportes.html';
                enlaceReportes.textContent = rol === 'tecnico' ? 'Anomalías' : 'Reportes';
            }
        })
        .catch((error) => {
            console.error('No se pudo determinar el rol para el menú lateral:', error);
        });
}
