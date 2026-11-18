<?php
header('Content-Type: application/json; charset=utf-8');

if (session_status() === PHP_SESSION_NONE) {
    session_start();
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

require_once __DIR__ . '/../BD/DBConn.php';
if (!isset($conexion) || !$conexion instanceof mysqli || $conexion->connect_error) {
    http_response_code(503);
    echo json_encode(['success' => false, 'mensaje' => 'Los escenarios requieren conexión con MariaDB.']);
    exit;
}

require_once __DIR__ . '/../Modelos/Simulacion.php';
require_once __DIR__ . '/../Modelos/GeneradorEscenarioSimulacion.php';

$datos = json_decode(file_get_contents('php://input'), true);
if (!is_array($datos)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'mensaje' => 'Se esperaba un objeto JSON válido.']);
    exit;
}

$escenario = $datos['escenario'] ?? null;
$duracionMinutos = filter_var($datos['duracion_minutos'] ?? null, FILTER_VALIDATE_INT);
$intervaloSegundos = filter_var($datos['intervalo_segundos'] ?? null, FILTER_VALIDATE_INT);
$duracionesPermitidas = [30, 60, 360, 1440];
$intervalosPermitidos = [60, 300, 900, 3600];
$dispositivosEntrada = $datos['dispositivos'] ?? null;
if (
    !is_string($escenario)
    || !in_array($escenario, GeneradorEscenarioSimulacion::ESCENARIOS, true)
    || !is_int($duracionMinutos)
    || !in_array($duracionMinutos, $duracionesPermitidas, true)
    || !is_int($intervaloSegundos)
    || !in_array($intervaloSegundos, $intervalosPermitidos, true)
    || ($duracionMinutos * 60) % $intervaloSegundos !== 0
    || !is_array($dispositivosEntrada)
    || count($dispositivosEntrada) === 0
) {
    http_response_code(422);
    echo json_encode(['success' => false, 'mensaje' => 'Revisa el escenario, la duración, el intervalo y los dispositivos.']);
    exit;
}

$cantidadPasos = intdiv($duracionMinutos * 60, $intervaloSegundos);
if (($cantidadPasos + 1) * count($dispositivosEntrada) > 20000) {
    http_response_code(422);
    echo json_encode(['success' => false, 'mensaje' => 'La combinación genera demasiadas mediciones. Aumenta el intervalo o reduce el periodo.']);
    exit;
}

$dispositivos = [];
foreach ($dispositivosEntrada as $indice => $dispositivo) {
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
        || !is_finite((float) $latencia)
        || $anchoBanda === false
        || !is_finite((float) $anchoBanda)
        || $latencia < 0
        || $anchoBanda < 0
        || !in_array($modo, ['automatico', 'manual'], true)
    ) {
        http_response_code(422);
        echo json_encode(['success' => false, 'mensaje' => "Datos inválidos en la posición {$indice}."]);
        exit;
    }
    $dispositivos[] = [
        'id_dispositivo' => $id,
        'name_dispositivo' => trim((string) ($dispositivo['name_dispositivo'] ?? '')),
        'ip_dispositivo' => trim((string) ($dispositivo['ip_dispositivo'] ?? '')),
        'sede' => trim((string) ($dispositivo['sede'] ?? '')),
        'modo' => $modo,
        'conectividad' => $conectividad,
        'latencia' => $conectividad === 1 ? (float) $latencia : 0.0,
        'ancho_banda' => $conectividad === 1 ? (float) $anchoBanda : 0.0
    ];
}

$idsDispositivos = array_column($dispositivos, 'id_dispositivo');
if (count(array_unique($idsDispositivos)) !== count($idsDispositivos)) {
    http_response_code(422);
    echo json_encode(['success' => false, 'mensaje' => 'Cada dispositivo solo puede aparecer una vez en un escenario.']);
    exit;
}

$nombresEscenario = [
    'caida' => 'Caída de conectividad',
    'latencia' => 'Latencia elevada',
    'congestion' => 'Congestión de red',
    'recuperacion' => 'Recuperación de servicio'
];
$nombre = $nombresEscenario[$escenario] . ' · ' . date('Y-m-d H:i');
$semillaGeneracion = random_int(1, 2147483647);

$duracionSegundos = $duracionMinutos * 60;
$intervaloSegundos = (int) $intervaloSegundos;

$stmtDispositivo = $conexion->prepare(
    'UPDATE dispositivo
     SET status = ?, BW_dispositivo = ?, latencia_dispositivo = ?, fecha = CURDATE()
     WHERE id_dispositivo = ?'
);
if (!$stmtDispositivo) {
    error_log('No se pudo preparar la actualización del dispositivo: ' . $conexion->error);
    http_response_code(500);
    echo json_encode(['success' => false, 'mensaje' => 'No se pudo preparar el guardado del escenario.']);
    exit;
}
$stmtMedicion = $conexion->prepare(
    'INSERT INTO simulacion
        (id_dispositivo, conectividad, latencia, ancho_banda, modo, fecha_registro,
         origen, indice_paso)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
);
if (!$stmtMedicion) {
    $stmtDispositivo->close();
    error_log('No se pudo preparar el registro de mediciones: ' . $conexion->error);
    http_response_code(500);
    echo json_encode(['success' => false, 'mensaje' => 'No se pudo preparar el guardado de las mediciones.']);
    exit;
}

try {
    if (!$conexion->begin_transaction()) {
        throw new RuntimeException('No se pudo iniciar la transacción del escenario.');
    }
    $resultadoReloj = $conexion->query('SELECT NOW() AS ahora');
    $filaReloj = $resultadoReloj ? $resultadoReloj->fetch_assoc() : null;
    if (!$filaReloj || !is_string($filaReloj['ahora'] ?? null)) {
        throw new RuntimeException('No se pudo consultar la hora de MariaDB.');
    }
    $fechaHasta = DateTimeImmutable::createFromFormat(
        '!Y-m-d H:i:s',
        $filaReloj['ahora'],
        new DateTimeZone('UTC')
    );
    $resultadoReloj->free();
    if (!$fechaHasta) {
        throw new RuntimeException('MariaDB devolvió una hora no válida.');
    }

    $mediciones = GeneradorEscenarioSimulacion::generar(
        $dispositivos,
        $escenario,
        $duracionSegundos,
        $intervaloSegundos,
        $semillaGeneracion,
        $fechaHasta
    );
    foreach ($mediciones as $medicion) {
        $simulacion = new Simulacion(
            $medicion['id_dispositivo'],
            $medicion['conectividad'],
            $medicion['latencia'],
            $medicion['ancho_banda'],
            $medicion['modo'],
            $medicion['name_dispositivo'],
            $medicion['ip_dispositivo'],
            $medicion['sede'],
            $medicion['fecha_registro'],
            null,
            'simulado',
            $medicion['indice_paso'],
            $nombre,
            $escenario
        );
        $simulacion->guardar($conexion, $stmtMedicion);

        if ($medicion['indice_paso'] !== $cantidadPasos) {
            continue;
        }
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

    if (!$conexion->commit()) {
        throw new RuntimeException('No se pudo confirmar el guardado del escenario.');
    }
    $stmtDispositivo->close();
    $stmtMedicion->close();
    echo json_encode([
        'success' => true,
        'mensaje' => 'Escenario guardado correctamente.',
        'origen' => 'bd',
        'nombre' => $nombre,
        'escenario' => $escenario,
        'registros' => count($mediciones),
        'fecha_desde' => $mediciones[0]['fecha_registro'],
        'fecha_hasta' => $mediciones[count($mediciones) - 1]['fecha_registro']
    ]);
} catch (Throwable $error) {
    $conexion->rollback();
    $stmtDispositivo->close();
    $stmtMedicion->close();
    error_log('Error al guardar el escenario: ' . $error->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'mensaje' => 'No se pudo guardar el escenario en la base de datos.']);
}
