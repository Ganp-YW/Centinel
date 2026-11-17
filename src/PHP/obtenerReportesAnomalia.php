<?php
header('Content-Type: application/json; charset=utf-8');

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$rol = $_SESSION['type'] ?? '';
if (!isset($_SESSION['id_usuario']) || !in_array($rol, ['Gerente', 'Tecnico', 'Técnico'], true)) {
    http_response_code(isset($_SESSION['id_usuario']) ? 403 : 401);
    echo json_encode(['success' => false, 'mensaje' => 'Se requiere una sesión de Gerente o Técnico.']);
    exit;
}

require_once __DIR__ . '/../BD/DBConn.php';
if (!isset($conexion) || !$conexion instanceof mysqli || $conexion->connect_error) {
    http_response_code(503);
    echo json_encode(['success' => false, 'mensaje' => 'No se pudieron consultar los reportes de anomalías en la base de datos.']);
    exit;
}
if (!$conexion->set_charset('utf8mb4')) {
    error_log('No se pudo configurar UTF-8 para consultar reportes de anomalías: ' . $conexion->error);
    http_response_code(500);
    echo json_encode(['success' => false, 'mensaje' => 'No se pudo preparar la codificación de los reportes.']);
    exit;
}

$sqlReportes = "
    SELECT r.id_reporte, r.tipo_objetivo, r.id_sede, r.id_dispositivo,
           r.nombre_objetivo, r.ip_objetivo, r.tipo_error, r.titulo, r.detalles,
           r.prioridad, r.estado, r.fecha_evento, r.id_creador, r.nombre_creador,
           r.fecha_creacion, r.fecha_actualizacion,
           s.name_sede AS sede_actual, d.name_dispositivo AS dispositivo_actual,
           d.ip_dispositivo AS ip_actual
    FROM reporte_anomalia r
    LEFT JOIN sede s ON s.id_sede = r.id_sede
    LEFT JOIN dispositivo d ON d.id_dispositivo = r.id_dispositivo
    ORDER BY FIELD(r.estado, 'pendiente', 'en_revision', 'resuelto'),
             FIELD(r.prioridad, 'critica', 'alta', 'media', 'baja'),
             r.fecha_evento DESC, r.id_reporte DESC
";
$resultado = $conexion->query($sqlReportes);
if (!$resultado) {
    error_log('No se pudieron consultar los reportes de anomalías: ' . $conexion->error);
    http_response_code(500);
    echo json_encode(['success' => false, 'mensaje' => 'No se pudieron cargar los reportes de anomalías.']);
    exit;
}

$reportes = [];
$ids = [];
while ($fila = $resultado->fetch_assoc()) {
    $fila['id_reporte'] = (int) $fila['id_reporte'];
    $fila['id_sede'] = $fila['id_sede'] !== null ? (int) $fila['id_sede'] : null;
    $fila['id_dispositivo'] = $fila['id_dispositivo'] !== null ? (int) $fila['id_dispositivo'] : null;
    $fila['id_creador'] = $fila['id_creador'] !== null ? (int) $fila['id_creador'] : null;
    $fila['nombre_objetivo'] = $fila['nombre_objetivo']
        ?: ($fila['dispositivo_actual'] ?? $fila['sede_actual'] ?? 'Objetivo eliminado');
    $fila['ip_objetivo'] = $fila['ip_objetivo'] ?: $fila['ip_actual'];
    $fila['historial'] = [];
    $ids[] = $fila['id_reporte'];
    $reportes[$fila['id_reporte']] = $fila;
}
$resultado->free();

if ($ids) {
    $marcadores = implode(',', array_fill(0, count($ids), '?'));
    $stmtHistorial = $conexion->prepare(
        "SELECT id_reporte, id_historial, id_usuario, nombre_usuario, accion,
                datos_anteriores, datos_nuevos, fecha_cambio
         FROM historial_reporte_anomalia
         WHERE id_reporte IN ({$marcadores})
         ORDER BY fecha_cambio ASC, id_historial ASC"
    );
    if (!$stmtHistorial) {
        error_log('No se pudo preparar la consulta de auditoría de reportes: ' . $conexion->error);
        http_response_code(500);
        echo json_encode(['success' => false, 'mensaje' => 'No se pudo cargar el historial de cambios.']);
        exit;
    }

    $tipos = str_repeat('i', count($ids));
    $parametros = [$tipos];
    foreach ($ids as &$id) {
        $parametros[] = &$id;
    }
    unset($id);
    if (!call_user_func_array([$stmtHistorial, 'bind_param'], $parametros)) {
        error_log('No se pudieron asociar los reportes a la consulta de auditoría.');
        http_response_code(500);
        echo json_encode(['success' => false, 'mensaje' => 'No se pudo preparar la consulta del historial.']);
        exit;
    }
    if (!$stmtHistorial->execute()) {
        error_log('No se pudo cargar la auditoría de reportes: ' . $stmtHistorial->error);
        http_response_code(500);
        echo json_encode(['success' => false, 'mensaje' => 'No se pudo cargar el historial de cambios.']);
        exit;
    }

    $historial = $stmtHistorial->get_result();
    while ($evento = $historial->fetch_assoc()) {
        $evento['id_historial'] = (int) $evento['id_historial'];
        $evento['id_usuario'] = $evento['id_usuario'] !== null ? (int) $evento['id_usuario'] : null;
        $evento['datos_anteriores'] = $evento['datos_anteriores'] !== null
            ? json_decode($evento['datos_anteriores'], true)
            : null;
        $evento['datos_nuevos'] = json_decode($evento['datos_nuevos'], true);
        $reportes[(int) $evento['id_reporte']]['historial'][] = $evento;
    }
    $stmtHistorial->close();
}

$resultadoSedes = $conexion->query('SELECT id_sede, name_sede FROM sede ORDER BY name_sede');
$resultadoDispositivos = $conexion->query(
    'SELECT d.id_dispositivo, d.name_dispositivo, d.ip_dispositivo, sd.id_sede, s.name_sede
     FROM dispositivo d
     LEFT JOIN sede_dispositivo sd ON sd.id_dispositivo = d.id_dispositivo
     LEFT JOIN sede s ON s.id_sede = sd.id_sede
     ORDER BY s.name_sede, d.name_dispositivo'
);
if (!$resultadoSedes || !$resultadoDispositivos) {
    error_log('No se pudieron consultar los objetivos de reportes: ' . $conexion->error);
    http_response_code(500);
    echo json_encode(['success' => false, 'mensaje' => 'No se pudieron cargar las sedes y dispositivos.']);
    exit;
}

$sedes = [];
while ($sede = $resultadoSedes->fetch_assoc()) {
    $sedes[] = ['id' => (int) $sede['id_sede'], 'nombre' => $sede['name_sede']];
}
$dispositivos = [];
while ($dispositivo = $resultadoDispositivos->fetch_assoc()) {
    $dispositivos[] = [
        'id' => (int) $dispositivo['id_dispositivo'],
        'nombre' => $dispositivo['name_dispositivo'],
        'ip' => $dispositivo['ip_dispositivo'],
        'id_sede' => $dispositivo['id_sede'] !== null ? (int) $dispositivo['id_sede'] : null,
        'sede' => $dispositivo['name_sede']
    ];
}
$resultadoSedes->free();
$resultadoDispositivos->free();

echo json_encode([
    'success' => true,
    'reportes' => array_values($reportes),
    'opciones' => ['sedes' => $sedes, 'dispositivos' => $dispositivos]
]);
