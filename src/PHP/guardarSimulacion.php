<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'mensaje' => 'Método no permitido. Use POST.']);
    exit;
}

if (!in_array($_SESSION['type'] ?? '', ['Gerente', 'Tecnico', 'Técnico'], true)) {
    http_response_code(isset($_SESSION['type']) ? 403 : 401);
    echo json_encode(['success' => false, 'mensaje' => 'Se requiere una sesión de Gerente o Técnico.']);
    exit;
}

$datos = json_decode(file_get_contents('php://input'), true);
if (!is_array($datos) || !isset($datos['dispositivos']) || !is_array($datos['dispositivos'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'mensaje' => 'Se esperaba un JSON con un array "dispositivos".']);
    exit;
}

if (count($datos['dispositivos']) === 0) {
    http_response_code(422);
    echo json_encode(['success' => false, 'mensaje' => 'El array de dispositivos está vacío.']);
    exit;
}

require_once __DIR__ . '/../Modelos/Simulacion.php';
$simulaciones = [];
foreach ($datos['dispositivos'] as $indice => $dispositivo) {
    if (!is_array($dispositivo)) {
        http_response_code(422);
        echo json_encode(['success' => false, 'mensaje' => "Datos inválidos en la posición {$indice}."]);
        exit;
    }

    $id = filter_var($dispositivo['id_dispositivo'] ?? null, FILTER_VALIDATE_INT);
    $conectividad = filter_var($dispositivo['conectividad'] ?? null, FILTER_VALIDATE_INT);
    $latencia = filter_var($dispositivo['latencia'] ?? null, FILTER_VALIDATE_FLOAT);
    $anchoBanda = filter_var($dispositivo['ancho_banda'] ?? null, FILTER_VALIDATE_FLOAT);
    $modo = $dispositivo['modo'] ?? 'automatico';

    if (
        $id === false
        || $id < 1
        || !in_array($conectividad, [0, 1], true)
        || $latencia === false
        || $anchoBanda === false
        || $latencia < 0
        || $anchoBanda < 0
        || !in_array($modo, ['automatico', 'manual'], true)
    ) {
        http_response_code(422);
        echo json_encode(['success' => false, 'mensaje' => "Datos inválidos en la posición {$indice}."]);
        exit;
    }

    $simulaciones[] = new Simulacion(
        $id,
        $conectividad,
        $conectividad === 1 ? (float) $latencia : 0.0,
        $conectividad === 1 ? (float) $anchoBanda : 0.0,
        $modo,
        trim((string) ($dispositivo['name_dispositivo'] ?? '')),
        trim((string) ($dispositivo['ip_dispositivo'] ?? '')),
        trim((string) ($dispositivo['sede'] ?? ''))
    );
}

$rutaConexion = __DIR__ . '/../BD/DBConn.php';
if (file_exists($rutaConexion)) {
    @include $rutaConexion;
}

if (isset($conexion) && $conexion instanceof mysqli && !$conexion->connect_error) {
    require_once __DIR__ . '/../Modelos/Simulacion.php';
    $stmtDispositivo = $conexion->prepare(
        "UPDATE dispositivo
         SET status = ?, BW_dispositivo = ?, latencia_dispositivo = ?, fecha = CURDATE()
         WHERE id_dispositivo = ?"
    );
    if (!$stmtDispositivo) {
        error_log('No se pudo preparar la actualización del dispositivo: ' . $conexion->error);
        http_response_code(500);
        echo json_encode(['success' => false, 'mensaje' => 'No se pudo preparar el guardado de la simulación.']);
        exit;
    }

    try {
        $conexion->begin_transaction();
        foreach ($simulaciones as $simulacion) {
            $simulacion->guardar($conexion);
            $idDispositivo = $simulacion->id_dispositivo;
            $conectividad = $simulacion->conectividad;
            $anchoBanda = $simulacion->ancho_banda;
            $latencia = $simulacion->latencia;
            $stmtDispositivo->bind_param(
                'iddi',
                $conectividad,
                $anchoBanda,
                $latencia,
                $idDispositivo
            );
            if (!$stmtDispositivo->execute()) {
                throw new RuntimeException('Falló la actualización del dispositivo.');
            }
        }
        $conexion->commit();
        $stmtDispositivo->close();
        echo json_encode([
            'success' => true,
            'mensaje' => 'Simulación registrada',
            'registros' => count($simulaciones),
            'origen' => 'bd'
        ]);
        exit;
    } catch (Throwable $error) {
        $conexion->rollback();
        $stmtDispositivo->close();
        error_log('Error al guardar la simulación: ' . $error->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'mensaje' => 'No se pudo guardar la simulación en la base de datos.']);
        exit;
    }
}

$fechaRegistro = date('Y-m-d H:i:s');
$historialDemo = $_SESSION['historialSimulacionesDemo'] ?? [];
foreach ($simulaciones as $simulacion) {
    $simulacion->fecha_registro = $fechaRegistro;
    $historialDemo[] = $simulacion->toArray();
}
$_SESSION['historialSimulacionesDemo'] = $historialDemo;

echo json_encode([
    'success' => true,
    'mensaje' => 'Simulación validada (modo demostración; no persistida)',
    'registros' => count($simulaciones),
    'origen' => 'memoria'
]);
