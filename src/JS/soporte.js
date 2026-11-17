const formularioSoporte = document.getElementById('formSoporte');

formularioSoporte?.addEventListener('submit', (evento) => {
    evento.preventDefault();

    const datos = new FormData(formularioSoporte);
    const asunto = datos.get('asunto');
    const asuntoTexto = document.getElementById('asunto').selectedOptions[0]?.textContent ?? asunto;
    const cuerpo = [
        `Nombre: ${datos.get('nombre')}`,
        `Correo: ${datos.get('correo')}`,
        `Sede: ${datos.get('sede')}`,
        `Asunto: ${asuntoTexto}`,
        '',
        String(datos.get('mensaje'))
    ].join('\n');
    const enlaceCorreo = document.createElement('a');
    enlaceCorreo.href = `mailto:soporte@centinel.com?subject=${encodeURIComponent(`Soporte Centinel - ${asuntoTexto}`)}&body=${encodeURIComponent(cuerpo)}`;
    enlaceCorreo.className = 'font-semibold text-sky-700 underline hover:text-sky-900';
    enlaceCorreo.textContent = 'Abrir borrador de correo';

    const estado = document.getElementById('mensajeEstado');
    estado.replaceChildren(document.createTextNode('El mensaje está listo. '), enlaceCorreo);
});
