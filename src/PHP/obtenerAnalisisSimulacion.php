<?php
header('Content-Type: application/json; charset=utf-8');

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$rol = $_SESSION['type'] ?? '';
if (!isset($_SESSION['id_usuario']) || $rol !== 'Gerente') {
    http_response_code(isset($_SESSION['id_usuario']) ? 403 : 401);
    echo json_encode(['success' => false, 'mensaje' => 'Se requiere una sesión de Gerente.']);
    exit;
}

$granularidad = $_GET['granularidad'] ?? 'dia';
$idSede = $_GET['id_sede'] ?? '';
$idDispositivo = $_GET['id_dispositivo'] ?? '';
$granularidadesDetalle = [
    'anio' => 'mes',
    'mes' => 'dia',
    'semana' => 'dia',
    'dia' => 'hora',
    'hora' => 'minuto'
];
$expresiones = [
    'anio' => "DATE_FORMAT(s.fecha_registro, '%Y-%m')",
    'mes' => 'DATE(s.fecha_registro)',
    'semana' => 'DATE(s.fecha_registro)',
    'dia' => "DATE_FORMAT(s.fecha_registro, '%Y-%m-%d %H:00')",
    'hora' => "CONCAT(DATE_FORMAT(s.fecha_registro, '%Y-%m-%d %H:'), LPAD(FLOOR(MINUTE(s.fecha_registro) / 5) * 5, 2, '0'))"
];
$ventanasSegundos = [
    'anio' => 365 * 24 * 60 * 60,
    'mes' => 30 * 24 * 60 * 60,
    'semana' => 7 * 24 * 60 * 60,
    'dia' => 24 * 60 * 60,
    'hora' => 60 * 60
];

function inicioPeriodoAnalisis(DateTimeImmutable $fecha, string $granularidad): DateTimeImmutable
{
    return match ($granularidad) {
        'mes' => $fecha->modify('first day of this month')->setTime(0, 0),
        'semana' => $fecha->modify('monday this week')->setTime(0, 0),
        'dia' => $fecha->setTime(0, 0),
        'hora' => $fecha->setTime((int) $fecha->format('H'), 0),
        'minuto' => $fecha->setTime(
            (int) $fecha->format('H'),
            intdiv((int) $fecha->format('i'), 5) * 5
        ),
    };
}

function etiquetaPeriodoAnalisis(DateTimeImmutable $fecha, string $granularidad): string
{
    return match ($granularidad) {
        'mes' => $fecha->format('Y-m'),
        'hora' => $fecha->format('Y-m-d H:00'),
        'minuto' => $fecha->format('Y-m-d H:i'),
        default => $fecha->format('Y-m-d'),
    };
}

if (!is_string($granularidad) || !isset($expresiones[$granularidad])) {
    http_response_code(422);
    echo json_encode(['success' => false, 'mensaje' => 'Selecciona una granularidad válida.']);
    exit;
}
foreach (['idSede' => $idSede, 'idDispositivo' => $idDispositivo] as $valor) {
    if ($valor !== '' && (!is_string($valor) || filter_var($valor, FILTER_VALIDATE_INT) === false || (int) $valor < 1)) {
        http_response_code(422);
        echo json_encode(['success' => false, 'mensaje' => 'El filtro de sede o dispositivo no es válido.']);
        exit;
    }
}

require_once __DIR__ . '/../BD/DBConn.php';
$conexionDisponible = isset($conexion) && $conexion instanceof mysqli && !$conexion->connect_error;
if ($conexionDisponible && !$conexion->set_charset('utf8mb4')) {
    error_log('No se pudo configurar UTF-8 para el análisis de simulaciones: ' . $conexion->error);
    http_response_code(500);
    echo json_encode(['success' => false, 'mensaje' => 'No se pudo preparar la codificación del análisis.']);
    exit;
}

$maxSegundos = $ventanasSegundos[$granularidad];
if ($conexionDisponible) {
    $resultadoReloj = $conexion->query('SELECT NOW() AS ahora');
    $filaReloj = $resultadoReloj ? $resultadoReloj->fetch_assoc() : null;
    if (!$filaReloj || !is_string($filaReloj['ahora'] ?? null)) {
        error_log('No se pudo consultar la hora de MariaDB para el análisis de simulaciones: ' . $conexion->error);
        http_response_code(500);
        echo json_encode(['success' => false, 'mensaje' => 'No se pudo determinar el periodo reciente del análisis.']);
        exit;
    }
    $fechaHasta = DateTimeImmutable::createFromFormat(
        '!Y-m-d H:i:s',
        $filaReloj['ahora'],
        new DateTimeZone('UTC')
    );
    if (!$fechaHasta) {
        error_log('MariaDB devolvió una hora no válida para el análisis de simulaciones.');
        http_response_code(500);
        echo json_encode(['success' => false, 'mensaje' => 'No se pudo determinar el periodo reciente del análisis.']);
        exit;
    }
} else {
    $fechaHasta = new DateTimeImmutable();
}
$fechaDesde = $fechaHasta->modify("-{$maxSegundos} seconds");
$desdeSql = $fechaDesde->format('Y-m-d H:i:s');
$hastaSql = $fechaHasta->format('Y-m-d H:i:s');

$opciones = ['sedes' => [], 'dispositivos' => []];
$filas = [];
$muestras = [];
$origen = 'bd';

if ($conexionDisponible) {
    $resultadoOpciones = $conexion->query(
        'SELECT s.id_sede, s.name_sede FROM sede s ORDER BY s.name_sede'
    );
    $resultadoDispositivos = $conexion->query(
        'SELECT DISTINCT d.id_dispositivo, d.name_dispositivo, d.ip_dispositivo,
                sd.id_sede, s.name_sede
         FROM dispositivo d
         LEFT JOIN sede_dispositivo sd ON sd.id_dispositivo = d.id_dispositivo
         LEFT JOIN sede s ON s.id_sede = sd.id_sede
         ORDER BY s.name_sede, d.name_dispositivo'
    );
    if (!$resultadoOpciones || !$resultadoDispositivos) {
        error_log('No se pudieron consultar filtros del análisis de simulaciones: ' . $conexion->error);
        http_response_code(500);
        echo json_encode(['success' => false, 'mensaje' => 'No se pudieron cargar las opciones de filtro.']);
        exit;
    }
    while ($fila = $resultadoOpciones->fetch_assoc()) {
        $opciones['sedes'][] = ['id' => (int) $fila['id_sede'], 'nombre' => $fila['name_sede']];
    }
    while ($fila = $resultadoDispositivos->fetch_assoc()) {
        $opciones['dispositivos'][] = [
            'id' => (int) $fila['id_dispositivo'],
            'nombre' => $fila['name_dispositivo'],
            'sede' => $fila['name_sede'],
            'id_sede' => $fila['id_sede'] !== null ? (int) $fila['id_sede'] : null
        ];
    }
    $resultadoOpciones->free();
    $resultadoDispositivos->free();

    $bucket = $expresiones[$granularidad];
    $sql = "
        SELECT {$bucket} AS periodo,
               COUNT(*) AS total,
               SUM(s.conectividad = 1) AS conectados,
               SUM(s.modo = 'automatico') AS automaticos,
               SUM(s.modo = 'manual') AS manuales,
               COUNT(CASE WHEN s.conectividad = 1 AND s.latencia > 0 THEN 1 END) AS n_latencia,
               AVG(CASE WHEN s.conectividad = 1 AND s.latencia > 0 THEN s.latencia END) AS media_latencia,
               STDDEV_SAMP(CASE WHEN s.conectividad = 1 AND s.latencia > 0 THEN s.latencia END) AS desviacion_latencia,
               COUNT(CASE WHEN s.conectividad = 1 AND s.ancho_banda > 0 THEN 1 END) AS n_ancho_banda,
               AVG(CASE WHEN s.conectividad = 1 AND s.ancho_banda > 0 THEN s.ancho_banda END) AS media_ancho_banda,
               STDDEV_SAMP(CASE WHEN s.conectividad = 1 AND s.ancho_banda > 0 THEN s.ancho_banda END) AS desviacion_ancho_banda
        FROM simulacion s
        INNER JOIN dispositivo d ON d.id_dispositivo = s.id_dispositivo
        WHERE s.fecha_registro >= ? AND s.fecha_registro <= ?
    ";
    if ($idSede !== '') {
        $sql .= ' AND EXISTS (
            SELECT 1 FROM sede_dispositivo sd_filter
            WHERE sd_filter.id_dispositivo = s.id_dispositivo AND sd_filter.id_sede = ?
        )';
    }
    if ($idDispositivo !== '') {
        $sql .= ' AND s.id_dispositivo = ?';
    }
    $sql .= " GROUP BY periodo ORDER BY periodo";

    $stmt = $conexion->prepare($sql);
    if (!$stmt) {
        error_log('No se pudo preparar el análisis de simulaciones: ' . $conexion->error);
        http_response_code(500);
        echo json_encode(['success' => false, 'mensaje' => 'No se pudo preparar el análisis histórico.']);
        exit;
    }
    if ($idSede !== '' && $idDispositivo !== '') {
        $idSedeParametro = (int) $idSede;
        $idDispositivoParametro = (int) $idDispositivo;
        $stmt->bind_param('ssii', $desdeSql, $hastaSql, $idSedeParametro, $idDispositivoParametro);
    } elseif ($idSede !== '') {
        $idSedeParametro = (int) $idSede;
        $stmt->bind_param('ssi', $desdeSql, $hastaSql, $idSedeParametro);
    } elseif ($idDispositivo !== '') {
        $idDispositivoParametro = (int) $idDispositivo;
        $stmt->bind_param('ssi', $desdeSql, $hastaSql, $idDispositivoParametro);
    } else {
        $stmt->bind_param('ss', $desdeSql, $hastaSql);
    }
    if (!$stmt->execute()) {
        error_log('No se pudo calcular el análisis de simulaciones: ' . $stmt->error);
        http_response_code(500);
        echo json_encode(['success' => false, 'mensaje' => 'No se pudo calcular el análisis histórico.']);
        exit;
    }
    $resultado = $stmt->get_result();
    while ($fila = $resultado->fetch_assoc()) {
        $filas[] = $fila;
    }
    $stmt->close();

    $sqlMuestras = "
        SELECT s.fecha_registro, s.conectividad, s.latencia, s.ancho_banda
        FROM simulacion s
        WHERE s.fecha_registro >= ? AND s.fecha_registro <= ?
    ";
    if ($idSede !== '') {
        $sqlMuestras .= ' AND EXISTS (
            SELECT 1 FROM sede_dispositivo sd_filter
            WHERE sd_filter.id_dispositivo = s.id_dispositivo AND sd_filter.id_sede = ?
        )';
    }
    if ($idDispositivo !== '') {
        $sqlMuestras .= ' AND s.id_dispositivo = ?';
    }
    $sqlMuestras .= ' ORDER BY s.fecha_registro DESC, s.id_simulacion DESC LIMIT 1000';

    $stmtMuestras = $conexion->prepare($sqlMuestras);
    if (!$stmtMuestras) {
        error_log('No se pudo preparar la serie de muestras de simulación: ' . $conexion->error);
        http_response_code(500);
        echo json_encode(['success' => false, 'mensaje' => 'No se pudo preparar la serie de mediciones.']);
        exit;
    }
    if ($idSede !== '' && $idDispositivo !== '') {
        $idSedeParametro = (int) $idSede;
        $idDispositivoParametro = (int) $idDispositivo;
        $stmtMuestras->bind_param('ssii', $desdeSql, $hastaSql, $idSedeParametro, $idDispositivoParametro);
    } elseif ($idSede !== '') {
        $idSedeParametro = (int) $idSede;
        $stmtMuestras->bind_param('ssi', $desdeSql, $hastaSql, $idSedeParametro);
    } elseif ($idDispositivo !== '') {
        $idDispositivoParametro = (int) $idDispositivo;
        $stmtMuestras->bind_param('ssi', $desdeSql, $hastaSql, $idDispositivoParametro);
    } else {
        $stmtMuestras->bind_param('ss', $desdeSql, $hastaSql);
    }
    if (!$stmtMuestras->execute()) {
        error_log('No se pudo consultar la serie de muestras de simulación: ' . $stmtMuestras->error);
        http_response_code(500);
        echo json_encode(['success' => false, 'mensaje' => 'No se pudo consultar la serie de mediciones.']);
        exit;
    }
    $resultadoMuestras = $stmtMuestras->get_result();
    while ($muestra = $resultadoMuestras->fetch_assoc()) {
        $muestras[] = [
            'fecha_registro' => $muestra['fecha_registro'],
            'conectividad' => (int) $muestra['conectividad'],
            'latencia' => (float) $muestra['latencia'],
            'ancho_banda' => (float) $muestra['ancho_banda']
        ];
    }
    $stmtMuestras->close();
    $muestras = array_reverse($muestras);
} else {
    $origen = 'memoria';
    $grupos = [];
    $muestrasFiltradas = [];
    $historialDemo = $_SESSION['historialSimulacionesDemo'] ?? [];
    $nombresSedes = [];
    foreach ($historialDemo as $fila) {
        $nombre = trim((string) ($fila['sede'] ?? ''));
        if ($nombre !== '') {
            $nombresSedes[strtolower($nombre)] = $nombre;
        }
    }
    uasort($nombresSedes, static fn(string $a, string $b): int => strcasecmp($a, $b));
    $idSedePorNombre = [];
    foreach (array_values($nombresSedes) as $indice => $nombre) {
        $idSedePorNombre[strtolower($nombre)] = $indice + 1;
        $opciones['sedes'][] = ['id' => $indice + 1, 'nombre' => $nombre];
    }
    foreach ($historialDemo as $fila) {
        $nombreSede = trim((string) ($fila['sede'] ?? ''));
        $idSedeFila = $idSedePorNombre[strtolower($nombreSede)] ?? null;
        $id = (int) ($fila['id_dispositivo'] ?? 0);
        $opciones['dispositivos'][$id] = [
            'id' => $id,
            'nombre' => $fila['name_dispositivo'] ?? "Dispositivo {$id}",
            'sede' => $nombreSede,
            'id_sede' => $idSedeFila
        ];
        $fechaTexto = $fila['fecha_registro'] ?? '';
        try {
            $fecha = new DateTimeImmutable($fechaTexto);
        } catch (Throwable) {
            continue;
        }
        if ($fecha < $fechaDesde || $fecha > $fechaHasta) {
            continue;
        }
        if ($idSede !== '' && $idSedeFila !== (int) $idSede) {
            continue;
        }
        if ($idDispositivo !== '' && (int) ($fila['id_dispositivo'] ?? 0) !== (int) $idDispositivo) {
            continue;
        }
        $muestrasFiltradas[] = [
            'fecha_registro' => $fecha->format('Y-m-d H:i:s'),
            'conectividad' => (int) ($fila['conectividad'] ?? 0),
            'latencia' => (float) ($fila['latencia'] ?? 0),
            'ancho_banda' => (float) ($fila['ancho_banda'] ?? 0)
        ];
        $granularidadPeriodo = $granularidadesDetalle[$granularidad];
        $periodo = etiquetaPeriodoAnalisis(
            inicioPeriodoAnalisis($fecha, $granularidadPeriodo),
            $granularidadPeriodo
        );
        if (!isset($grupos[$periodo])) {
            $grupos[$periodo] = [
                'periodo' => $periodo, 'total' => 0, 'conectados' => 0,
                'automaticos' => 0, 'manuales' => 0, 'latencias' => [], 'anchos' => []
            ];
        }
        $grupos[$periodo]['total']++;
        $grupos[$periodo]['conectados'] += (int) ($fila['conectividad'] ?? 0) === 1 ? 1 : 0;
        $grupos[$periodo][$fila['modo'] === 'automatico' ? 'automaticos' : 'manuales']++;
        if ((int) ($fila['conectividad'] ?? 0) === 1) {
            if ((float) ($fila['latencia'] ?? 0) > 0) $grupos[$periodo]['latencias'][] = (float) $fila['latencia'];
            if ((float) ($fila['ancho_banda'] ?? 0) > 0) $grupos[$periodo]['anchos'][] = (float) $fila['ancho_banda'];
        }
    }
    foreach ($grupos as $grupo) {
        $cantidadLatencia = count($grupo['latencias']);
        $cantidadAncho = count($grupo['anchos']);
        $mediaLatencia = $cantidadLatencia ? array_sum($grupo['latencias']) / $cantidadLatencia : null;
        $mediaAncho = $cantidadAncho ? array_sum($grupo['anchos']) / $cantidadAncho : null;
        $desvLatencia = $cantidadLatencia > 1
            ? sqrt(array_sum(array_map(static fn(float $valor): float => ($valor - $mediaLatencia) ** 2, $grupo['latencias'])) / ($cantidadLatencia - 1))
            : null;
        $desvAncho = $cantidadAncho > 1
            ? sqrt(array_sum(array_map(static fn(float $valor): float => ($valor - $mediaAncho) ** 2, $grupo['anchos'])) / ($cantidadAncho - 1))
            : null;
        $filas[] = [
            'periodo' => $grupo['periodo'],
            'total' => $grupo['total'],
            'conectados' => $grupo['conectados'],
            'automaticos' => $grupo['automaticos'],
            'manuales' => $grupo['manuales'],
            'n_latencia' => $cantidadLatencia,
            'media_latencia' => $mediaLatencia,
            'desviacion_latencia' => $desvLatencia,
            'n_ancho_banda' => $cantidadAncho,
            'media_ancho_banda' => $mediaAncho,
            'desviacion_ancho_banda' => $desvAncho
        ];
    }
    $opciones['sedes'] = array_values($opciones['sedes']);
    $opciones['dispositivos'] = array_values($opciones['dispositivos']);
    usort($filas, static fn(array $a, array $b): int => strcmp($a['periodo'], $b['periodo']));
    usort($muestrasFiltradas, static fn(array $a, array $b): int => strcmp($a['fecha_registro'], $b['fecha_registro']));
    $muestras = array_slice($muestrasFiltradas, -1000);
}

$filasPorPeriodo = [];
foreach ($filas as $fila) {
    $filasPorPeriodo[$fila['periodo']] = $fila;
}
$filas = [];
$granularidadPeriodo = $granularidadesDetalle[$granularidad];
$cursorPeriodo = inicioPeriodoAnalisis($fechaDesde, $granularidadPeriodo);
$ultimoPeriodo = inicioPeriodoAnalisis($fechaHasta, $granularidadPeriodo);
while ($cursorPeriodo <= $ultimoPeriodo) {
    $clavePeriodo = etiquetaPeriodoAnalisis($cursorPeriodo, $granularidadPeriodo);
    $filas[] = $filasPorPeriodo[$clavePeriodo] ?? [
        'periodo' => $clavePeriodo,
        'total' => 0,
        'conectados' => 0,
        'automaticos' => 0,
        'manuales' => 0,
        'n_latencia' => 0,
        'media_latencia' => null,
        'desviacion_latencia' => null,
        'n_ancho_banda' => 0,
        'media_ancho_banda' => null,
        'desviacion_ancho_banda' => null
    ];
    $cursorPeriodo = match ($granularidadPeriodo) {
        'mes' => $cursorPeriodo->modify('+1 month'),
        'dia' => $cursorPeriodo->modify('+1 day'),
        'hora' => $cursorPeriodo->modify('+1 hour'),
        'minuto' => $cursorPeriodo->modify('+5 minutes'),
    };
}

$periodos = array_map(static function (array $fila): array {
    $total = (int) $fila['total'];
    $conectados = (int) $fila['conectados'];
    return [
        'periodo' => $fila['periodo'],
        'total' => $total,
        'conectados' => $conectados,
        'probabilidad_conectado' => $total ? $conectados / $total : null,
        'automaticos' => (int) $fila['automaticos'],
        'manuales' => (int) $fila['manuales'],
        'n_latencia' => (int) $fila['n_latencia'],
        'media_latencia' => $fila['media_latencia'] !== null ? (float) $fila['media_latencia'] : null,
        'desviacion_latencia' => $fila['desviacion_latencia'] !== null ? (float) $fila['desviacion_latencia'] : null,
        'n_ancho_banda' => (int) $fila['n_ancho_banda'],
        'media_ancho_banda' => $fila['media_ancho_banda'] !== null ? (float) $fila['media_ancho_banda'] : null,
        'desviacion_ancho_banda' => $fila['desviacion_ancho_banda'] !== null ? (float) $fila['desviacion_ancho_banda'] : null
    ];
}, $filas);
$totalMediciones = array_sum(array_column($periodos, 'total'));

echo json_encode([
    'success' => true,
    'origen' => $origen,
    'granularidad' => $granularidad,
    'granularidad_intervalo' => $granularidadPeriodo,
    'desde' => $desdeSql,
    'hasta' => $hastaSql,
    'opciones' => $opciones,
    'periodos' => $periodos,
    'muestras' => $muestras,
    'muestras_limitadas' => $totalMediciones > count($muestras)
]);
