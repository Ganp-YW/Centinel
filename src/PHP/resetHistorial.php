<?php
header('Content-Type: application/json; charset=utf-8');

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

if (!in_array($_SESSION['type'] ?? '', ['Gerente', 'Tecnico', 'Técnico'], true)) {
    http_response_code(isset($_SESSION['type']) ? 403 : 401);
    echo json_encode(['success' => false, 'mensaje' => 'Se requiere una sesión de Gerente o Técnico.']);
    exit;
}

$rutaConexion = __DIR__ . '/../BD/DBConn.php';
if (file_exists($rutaConexion)) {
    @include $rutaConexion;
}

if (isset($conexion) && $conexion instanceof mysqli && !$conexion->connect_error) {
    $resultado = $conexion->query('DELETE FROM simulacion');
    if ($resultado === false) {
        http_response_code(500);
        echo json_encode(['success' => false, 'mensaje' => 'No se pudo limpiar la tabla de simulaciones.']);
        exit;
    }

    $conexion->query('ALTER TABLE simulacion AUTO_INCREMENT = 1');
    echo json_encode([
        'success' => true,
        'origen' => 'bd',
        'mensaje' => 'Historial limpio correctamente.'
    ]);
    exit;
}

$_SESSION['historialSimulacionesDemo'] = [];
echo json_encode([
    'success' => true,
    'origen' => 'memoria',
    'mensaje' => 'Historial de demostración reiniciado.'
]);
