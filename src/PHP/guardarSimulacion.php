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

function fechaConPatronHistorico(string $patron, ?DateTimeImmutable $ahora = null): string
{
    $ahora ??= new DateTimeImmutable();
    $fechaPatron = new DateTimeImmutable($patron, $ahora->getTimezone());
    $anio = (int) $ahora->format('Y');
    $mes = (int) $fechaPatron->format('m');
    $diaPatron = (int) $fechaPatron->format('d');
    $crearFecha = static function (int $anio) use ($fechaPatron, $mes, $diaPatron): DateTimeImmutable {
        $primerDiaMes = new DateTimeImmutable(
            sprintf('%04d-%02d-01', $anio, $mes),
            $fechaPatron->getTimezone()
        );
        $dia = min($diaPatron, (int) $primerDiaMes->format('t'));
        return $fechaPatron->setDate($anio, $mes, $dia);
    };

    $fechaGenerada = $crearFecha($anio);
    if ($fechaGenerada > $ahora) {
        $fechaGenerada = $crearFecha($anio - 1);
    }
    return $fechaGenerada->format('Y-m-d H:i:s');
}

function fechaConMinutoAleatorio(
    string $patron,
    array $fechasUsadas,
    ?DateTimeImmutable $ahora = null
): string
{
    $ahora ??= new DateTimeImmutable();
    $fechaBase = new DateTimeImmutable($patron, $ahora->getTimezone());
    $hora = (int) $fechaBase->format('G');
    $inicioHora = $fechaBase->setTime($hora, 0, 0);
    $segundoMaximo = 3599;
    if ($inicioHora->format('Y-m-d H') === $ahora->format('Y-m-d H')) {
        $segundoMaximo = ((int) $ahora->format('i') * 60) + (int) $ahora->format('s');
        if ($segundoMaximo < count($fechasUsadas)) {
            $inicioHora = $inicioHora->modify('-1 year');
            $segundoMaximo = 3599;
        }
    }

    for ($intento = 0; $intento < 100; $intento++) {
        $segundos = random_int(0, $segundoMaximo);
        $fechaGenerada = $inicioHora->modify("+{$segundos} seconds")->format('Y-m-d H:i:s');
        if (!isset($fechasUsadas[$fechaGenerada])) {
            return $fechaGenerada;
        }
    }

    throw new RuntimeException('No se pudo generar una hora única para cada dispositivo.');
}

function fechaSuperAleatoria(
    array $fechasUsadas,
    DateTimeImmutable $fechaDesde,
    DateTimeImmutable $fechaHasta
): string
{
    $segundoInicial = $fechaDesde->getTimestamp();
    $segundoFinal = $fechaHasta->getTimestamp();

    for ($intento = 0; $intento < 100; $intento++) {
        $timestamp = random_int($segundoInicial, $segundoFinal);
        $fechaGenerada = (new DateTimeImmutable('@' . $timestamp))
            ->setTimezone($fechaHasta->getTimezone())
            ->format('Y-m-d H:i:s');
        if (!isset($fechasUsadas[$fechaGenerada])) {
            return $fechaGenerada;
        }
    }

    throw new RuntimeException('No se pudo generar una fecha aleatoria única para cada dispositivo.');
}

function horaMariaDB(mysqli $conexion): DateTimeImmutable
{
    $resultado = $conexion->query('SELECT NOW() AS ahora');
    $fila = $resultado ? $resultado->fetch_assoc() : null;
    if (!$fila || !is_string($fila['ahora'] ?? null)) {
        throw new RuntimeException('No se pudo consultar la hora de MariaDB.');
    }
    $resultado->free();
    $ahora = DateTimeImmutable::createFromFormat(
        '!Y-m-d H:i:s',
        $fila['ahora'],
        new DateTimeZone('UTC')
    );
    if (!$ahora) {
        throw new RuntimeException('MariaDB devolvió una hora no válida.');
    }
    return $ahora;
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

$modoFecha = $datos['modo_fecha'] ?? 'automatico';
$rangoFecha = $datos['rango_fecha'] ?? 'anio';
$ventanasFecha = [
    'hora' => 60 * 60,
    'dia' => 24 * 60 * 60,
    'semana' => 7 * 24 * 60 * 60,
    'mes' => 30 * 24 * 60 * 60,
    'anio' => 365 * 24 * 60 * 60
];
$fechaRegistro = null;
if (!in_array($modoFecha, ['manual', 'automatico', 'super_automatico'], true)) {
    http_response_code(422);
    echo json_encode(['success' => false, 'mensaje' => 'El modo de fecha de simulación no es válido.']);
    exit;
}
if ($modoFecha === 'super_automatico' && (!is_string($rangoFecha) || !isset($ventanasFecha[$rangoFecha]))) {
    http_response_code(422);
    echo json_encode(['success' => false, 'mensaje' => 'Selecciona un periodo válido para generar las fechas.']);
    exit;
}
if ($modoFecha === 'manual') {
    $fechaEntrada = $datos['fecha_registro'] ?? '';
    $fechaObjeto = is_string($fechaEntrada)
        ? DateTimeImmutable::createFromFormat('!Y-m-d\TH:i', $fechaEntrada)
        : false;
    $erroresFecha = DateTimeImmutable::getLastErrors();
    if (
        !$fechaObjeto
        || $fechaObjeto->format('Y-m-d\TH:i') !== $fechaEntrada
        || ($erroresFecha !== false && ($erroresFecha['warning_count'] || $erroresFecha['error_count']))
    ) {
        http_response_code(422);
        echo json_encode(['success' => false, 'mensaje' => 'Selecciona una fecha y hora válidas para la simulación.']);
        exit;
    }
    $fechaRegistro = $fechaObjeto->format('Y-m-d H:i:s');
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

    $simulacion = new Simulacion(
        $id,
        $conectividad,
        $conectividad === 1 ? (float) $latencia : 0.0,
        $conectividad === 1 ? (float) $anchoBanda : 0.0,
        $modo,
        trim((string) ($dispositivo['name_dispositivo'] ?? '')),
        trim((string) ($dispositivo['ip_dispositivo'] ?? '')),
        trim((string) ($dispositivo['sede'] ?? '')),
        $fechaRegistro
    );
    $simulacion->origen = 'simulado';
    $simulaciones[] = $simulacion;
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
        if (!$conexion->begin_transaction()) {
            throw new RuntimeException('No se pudo iniciar la transacción de simulación.');
        }
        $ahoraMariaDB = horaMariaDB($conexion);
        if ($modoFecha === 'automatico') {
            $limitePatrones = count($simulaciones);
            $resultadoFecha = $conexion->query(
                "SELECT patron FROM (
                     SELECT DISTINCT DATE_FORMAT(fecha_registro, '%m-%d %H') AS patron
                     FROM simulacion
                 ) AS patrones_historicos
                 ORDER BY RAND()
                 LIMIT {$limitePatrones}"
            );
            if (!$resultadoFecha) {
                throw new RuntimeException('No se pudo consultar el patrón temporal histórico.');
            }
            $patronesHistoricos = [];
            while ($filaPatron = $resultadoFecha->fetch_assoc()) {
                $patronesHistoricos[] = fechaConPatronHistorico(
                    '2000-' . $filaPatron['patron'] . ':00:00',
                    $ahoraMariaDB
                );
            }
            $resultadoFecha->free();
            $patronesHistoricos = array_values(array_unique($patronesHistoricos));
            if (!$patronesHistoricos) {
                $conexion->rollback();
                http_response_code(422);
                echo json_encode([
                    'success' => false,
                    'mensaje' => 'No hay patrones históricos. Elige una fecha manual o usa el modo «Por periodo» para generar fechas aleatorias.'
                ]);
                exit;
            }
            shuffle($patronesHistoricos);
        }
        $fechasUsadas = [];
        $fechaDesdeSuper = $modoFecha === 'super_automatico'
            ? $ahoraMariaDB->modify("-{$ventanasFecha[$rangoFecha]} seconds")
            : null;
        foreach ($simulaciones as $indice => $simulacion) {
            if ($modoFecha === 'super_automatico') {
                $simulacion->fecha_registro = fechaSuperAleatoria(
                    $fechasUsadas,
                    $fechaDesdeSuper,
                    $ahoraMariaDB
                );
                $fechasUsadas[$simulacion->fecha_registro] = true;
            } elseif ($modoFecha === 'automatico') {
                $patron = $patronesHistoricos[$indice % count($patronesHistoricos)];
                $simulacion->fecha_registro = fechaConMinutoAleatorio(
                    $patron,
                    $fechasUsadas,
                    $ahoraMariaDB
                );
                $fechasUsadas[$simulacion->fecha_registro] = true;
            }
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
        $fechasRegistro = array_values(array_unique(array_map(
            static fn(Simulacion $simulacion): string => (string) $simulacion->fecha_registro,
            $simulaciones
        )));
        echo json_encode([
            'success' => true,
            'mensaje' => 'Simulación registrada',
            'registros' => count($simulaciones),
            'fechas_registro' => $fechasRegistro,
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

$historialDemo = $_SESSION['historialSimulacionesDemo'] ?? [];
$estadoDemo = $_SESSION['estadoDispositivosSimulacionDemo'] ?? [];
$ahoraDemo = new DateTimeImmutable();
if ($modoFecha === 'automatico') {
    if (!$historialDemo) {
        http_response_code(422);
        echo json_encode([
            'success' => false,
            'mensaje' => 'No hay patrones históricos en esta sesión. Elige una fecha manual o usa el modo «Por periodo» para generar fechas aleatorias.'
        ]);
        exit;
    }
    $patronesHistoricos = [];
    foreach ($historialDemo as $registroHistorico) {
        $patronHistorico = $registroHistorico['fecha_registro'] ?? null;
        if (is_string($patronHistorico) && strtotime($patronHistorico)) {
            $patronesHistoricos[] = fechaConPatronHistorico(
                '2000-' . (new DateTimeImmutable($patronHistorico))->format('m-d H') . ':00:00',
                $ahoraDemo
            );
        }
    }
    $patronesHistoricos = array_values(array_unique($patronesHistoricos));
    if (!$patronesHistoricos) {
        http_response_code(422);
        echo json_encode(['success' => false, 'mensaje' => 'No se encontró un patrón temporal válido en el historial.']);
        exit;
    }
    shuffle($patronesHistoricos);
}
$fechasUsadas = [];
$fechaDesdeSuper = $modoFecha === 'super_automatico'
    ? $ahoraDemo->modify("-{$ventanasFecha[$rangoFecha]} seconds")
    : null;
foreach ($simulaciones as $indice => $simulacion) {
    if ($modoFecha === 'super_automatico') {
        $simulacion->fecha_registro = fechaSuperAleatoria(
            $fechasUsadas,
            $fechaDesdeSuper,
            $ahoraDemo
        );
        $fechasUsadas[$simulacion->fecha_registro] = true;
    } elseif ($modoFecha === 'automatico') {
        $patron = $patronesHistoricos[$indice % count($patronesHistoricos)];
        $simulacion->fecha_registro = fechaConMinutoAleatorio(
            $patron,
            $fechasUsadas,
            $ahoraDemo
        );
        $fechasUsadas[$simulacion->fecha_registro] = true;
    }
    $historialDemo[] = $simulacion->toArray();
    $estadoDemo[$simulacion->id_dispositivo] = [
        'status' => $simulacion->conectividad,
        'BW_dispositivo' => $simulacion->ancho_banda,
        'latencia_dispositivo' => $simulacion->latencia
    ];
}
$_SESSION['historialSimulacionesDemo'] = $historialDemo;
$_SESSION['estadoDispositivosSimulacionDemo'] = $estadoDemo;

$fechasRegistro = array_values(array_unique(array_map(
    static fn(Simulacion $simulacion): string => (string) $simulacion->fecha_registro,
    $simulaciones
)));
echo json_encode([
    'success' => true,
    'mensaje' => 'Simulación validada (modo demostración; no persistida)',
    'registros' => count($simulaciones),
    'fechas_registro' => $fechasRegistro,
    'origen' => 'memoria'
]);
