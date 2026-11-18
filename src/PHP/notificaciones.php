<?php
header('Content-Type: application/json; charset=utf-8');

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$idUsuario = filter_var($_SESSION['id_usuario'] ?? null, FILTER_VALIDATE_INT);
if ($idUsuario === false || $idUsuario === null) {
    http_response_code(401);
    echo json_encode(['success' => false, 'mensaje' => 'Inicia sesión para consultar notificaciones.']);
    exit;
}

require_once __DIR__ . '/../BD/DBConn.php';
if (!isset($conexion) || !$conexion instanceof mysqli || $conexion->connect_error) {
    http_response_code(503);
    echo json_encode(['success' => false, 'mensaje' => 'No se pudieron consultar las notificaciones.']);
    exit;
}
if (!$conexion->set_charset('utf8mb4')) {
    error_log('No se pudo configurar UTF-8 para las notificaciones: ' . $conexion->error);
    http_response_code(500);
    echo json_encode(['success' => false, 'mensaje' => 'No se pudo preparar la codificación de notificaciones.']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $datos = json_decode(file_get_contents('php://input'), true);
    if (!is_array($datos)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'mensaje' => 'El cuerpo debe contener un objeto JSON válido.']);
        exit;
    }

    if (($datos['accion'] ?? '') === 'marcar_todas_leidas') {
        $stmt = $conexion->prepare('UPDATE notificacion SET fecha_leida = CURRENT_TIMESTAMP WHERE id_usuario = ? AND fecha_leida IS NULL');
        if (!$stmt) {
            error_log('No se pudo preparar la actualización de notificaciones: ' . $conexion->error);
            http_response_code(500);
            echo json_encode(['success' => false, 'mensaje' => 'No se pudieron actualizar las notificaciones.']);
            exit;
        }
        $stmt->bind_param('i', $idUsuario);
    } elseif (($datos['accion'] ?? '') === 'marcar_leida') {
        $idNotificacion = filter_var($datos['id_notificacion'] ?? null, FILTER_VALIDATE_INT);
        if ($idNotificacion === false || $idNotificacion === null || $idNotificacion < 1) {
            http_response_code(422);
            echo json_encode(['success' => false, 'mensaje' => 'Notificación inválida.']);
            exit;
        }
        $stmt = $conexion->prepare('UPDATE notificacion SET fecha_leida = CURRENT_TIMESTAMP WHERE id_notificacion = ? AND id_usuario = ? AND fecha_leida IS NULL');
        if (!$stmt) {
            error_log('No se pudo preparar la actualización de notificación: ' . $conexion->error);
            http_response_code(500);
            echo json_encode(['success' => false, 'mensaje' => 'No se pudo actualizar la notificación.']);
            exit;
        }
        $stmt->bind_param('ii', $idNotificacion, $idUsuario);
    } else {
        http_response_code(422);
        echo json_encode(['success' => false, 'mensaje' => 'Acción de notificación inválida.']);
        exit;
    }

    if (!$stmt->execute()) {
        error_log('No se pudo actualizar notificación: ' . $stmt->error);
        $stmt->close();
        http_response_code(500);
        echo json_encode(['success' => false, 'mensaje' => 'No se pudo actualizar la notificación.']);
        exit;
    }
    $stmt->close();
    echo json_encode(['success' => true]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'mensaje' => 'Método no permitido.']);
    exit;
}

$stmtPendientes = $conexion->prepare('SELECT COUNT(*) AS pendientes FROM notificacion WHERE id_usuario = ? AND fecha_leida IS NULL');
if (!$stmtPendientes) {
    error_log('No se pudo preparar el conteo de notificaciones: ' . $conexion->error);
    http_response_code(500);
    echo json_encode(['success' => false, 'mensaje' => 'No se pudieron consultar las notificaciones.']);
    exit;
}
$stmtPendientes->bind_param('i', $idUsuario);
if (!$stmtPendientes->execute()) {
    error_log('No se pudo contar las notificaciones: ' . $stmtPendientes->error);
    http_response_code(500);
    echo json_encode(['success' => false, 'mensaje' => 'No se pudieron consultar las notificaciones.']);
    exit;
}
$pendientes = (int) $stmtPendientes->get_result()->fetch_assoc()['pendientes'];
$stmtPendientes->close();

$stmtLista = $conexion->prepare(
    'SELECT id_notificacion, id_reporte, tipo, mensaje, fecha_creacion, fecha_leida
     FROM notificacion WHERE id_usuario = ?
     ORDER BY fecha_creacion DESC, id_notificacion DESC LIMIT 20'
);
if (!$stmtLista) {
    error_log('No se pudo preparar la lista de notificaciones: ' . $conexion->error);
    http_response_code(500);
    echo json_encode(['success' => false, 'mensaje' => 'No se pudieron consultar las notificaciones.']);
    exit;
}
$stmtLista->bind_param('i', $idUsuario);
if (!$stmtLista->execute()) {
    error_log('No se pudo consultar la lista de notificaciones: ' . $stmtLista->error);
    http_response_code(500);
    echo json_encode(['success' => false, 'mensaje' => 'No se pudieron consultar las notificaciones.']);
    exit;
}
$resultado = $stmtLista->get_result();
$notificaciones = [];
while ($fila = $resultado->fetch_assoc()) {
    $fila['id_notificacion'] = (int) $fila['id_notificacion'];
    $fila['id_reporte'] = $fila['id_reporte'] !== null ? (int) $fila['id_reporte'] : null;
    $notificaciones[] = $fila;
}
$stmtLista->close();

echo json_encode(['success' => true, 'pendientes' => $pendientes, 'notificaciones' => $notificaciones]);
