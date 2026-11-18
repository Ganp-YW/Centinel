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
    include $rutaConexion;
}

if (!isset($conexion) || !$conexion instanceof mysqli || $conexion->connect_error) {
    http_response_code(503);
    echo json_encode(['success' => false, 'mensaje' => 'No se pudieron consultar las estadísticas históricas en la base de datos.']);
    exit;
}

$sql = "
    SELECT 'dispositivo' AS nivel, d.id_dispositivo AS referencia, COALESCE(MAX(sd.id_sede), 0) AS id_sede,
           COUNT(s.id_simulacion) AS total,
           COALESCE(SUM(s.conectividad = 1), 0) AS conectados,
           COUNT(CASE WHEN s.conectividad = 1 AND s.latencia > 0 THEN 1 END) AS n_latencia,
           AVG(CASE WHEN s.conectividad = 1 AND s.latencia > 0 THEN s.latencia END) AS media_latencia,
           STDDEV_SAMP(CASE WHEN s.conectividad = 1 AND s.latencia > 0 THEN s.latencia END) AS desviacion_latencia,
           COUNT(CASE WHEN s.conectividad = 1 AND s.ancho_banda > 0 THEN 1 END) AS n_ancho_banda,
           AVG(CASE WHEN s.conectividad = 1 AND s.ancho_banda > 0 THEN s.ancho_banda END) AS media_ancho_banda,
           STDDEV_SAMP(CASE WHEN s.conectividad = 1 AND s.ancho_banda > 0 THEN s.ancho_banda END) AS desviacion_ancho_banda
    FROM dispositivo d
    LEFT JOIN sede_dispositivo sd ON sd.id_dispositivo = d.id_dispositivo
    LEFT JOIN simulacion s ON s.id_dispositivo = d.id_dispositivo AND s.indice_paso IS NULL
    GROUP BY d.id_dispositivo

    UNION ALL

    SELECT 'sede' AS nivel, sd.id_sede AS referencia, sd.id_sede AS id_sede,
           COUNT(*) AS total,
           SUM(s.conectividad = 1) AS conectados,
           COUNT(CASE WHEN s.conectividad = 1 AND s.latencia > 0 THEN 1 END) AS n_latencia,
           AVG(CASE WHEN s.conectividad = 1 AND s.latencia > 0 THEN s.latencia END) AS media_latencia,
           STDDEV_SAMP(CASE WHEN s.conectividad = 1 AND s.latencia > 0 THEN s.latencia END) AS desviacion_latencia,
           COUNT(CASE WHEN s.conectividad = 1 AND s.ancho_banda > 0 THEN 1 END) AS n_ancho_banda,
           AVG(CASE WHEN s.conectividad = 1 AND s.ancho_banda > 0 THEN s.ancho_banda END) AS media_ancho_banda,
           STDDEV_SAMP(CASE WHEN s.conectividad = 1 AND s.ancho_banda > 0 THEN s.ancho_banda END) AS desviacion_ancho_banda
    FROM simulacion s
    INNER JOIN sede_dispositivo sd ON sd.id_dispositivo = s.id_dispositivo
    WHERE s.indice_paso IS NULL
    GROUP BY sd.id_sede

    UNION ALL

    SELECT 'global' AS nivel, 0 AS referencia, 0 AS id_sede,
           COUNT(*) AS total,
           COALESCE(SUM(s.conectividad = 1), 0) AS conectados,
           COUNT(CASE WHEN s.conectividad = 1 AND s.latencia > 0 THEN 1 END) AS n_latencia,
           AVG(CASE WHEN s.conectividad = 1 AND s.latencia > 0 THEN s.latencia END) AS media_latencia,
           STDDEV_SAMP(CASE WHEN s.conectividad = 1 AND s.latencia > 0 THEN s.latencia END) AS desviacion_latencia,
           COUNT(CASE WHEN s.conectividad = 1 AND s.ancho_banda > 0 THEN 1 END) AS n_ancho_banda,
           AVG(CASE WHEN s.conectividad = 1 AND s.ancho_banda > 0 THEN s.ancho_banda END) AS media_ancho_banda,
           STDDEV_SAMP(CASE WHEN s.conectividad = 1 AND s.ancho_banda > 0 THEN s.ancho_banda END) AS desviacion_ancho_banda
    FROM simulacion s
    WHERE s.indice_paso IS NULL
";

$resultado = $conexion->query($sql);
if (!$resultado) {
    error_log('No se pudieron calcular las estadísticas de simulación: ' . $conexion->error);
    http_response_code(500);
    echo json_encode(['success' => false, 'mensaje' => 'No se pudieron calcular las estadísticas históricas.']);
    exit;
}

$porDispositivo = [];
$porSede = [];
$global = null;
while ($fila = $resultado->fetch_assoc()) {
    $estadistica = [
        'total' => (int) $fila['total'],
        'conectados' => (int) $fila['conectados'],
        'n_latencia' => (int) $fila['n_latencia'],
        'media_latencia' => $fila['media_latencia'] !== null ? (float) $fila['media_latencia'] : null,
        'desviacion_latencia' => $fila['desviacion_latencia'] !== null ? (float) $fila['desviacion_latencia'] : null,
        'n_ancho_banda' => (int) $fila['n_ancho_banda'],
        'media_ancho_banda' => $fila['media_ancho_banda'] !== null ? (float) $fila['media_ancho_banda'] : null,
        'desviacion_ancho_banda' => $fila['desviacion_ancho_banda'] !== null ? (float) $fila['desviacion_ancho_banda'] : null
    ];

    if ($fila['nivel'] === 'dispositivo') {
        $idDispositivo = (int) $fila['referencia'];
        $porDispositivo[$idDispositivo] = [
            'id_sede' => (int) $fila['id_sede'],
            'estadistica' => $estadistica
        ];
    } elseif ($fila['nivel'] === 'sede') {
        $porSede[(int) $fila['referencia']] = $estadistica;
    } else {
        $global = $estadistica;
    }
}
$resultado->free();

$estadisticasPorDispositivo = [];
foreach ($porDispositivo as $idDispositivo => $datosDispositivo) {
    $candidatos = [
        ['nivel' => 'dispositivo', 'datos' => $datosDispositivo['estadistica']],
        ['nivel' => 'sede', 'datos' => $porSede[$datosDispositivo['id_sede']] ?? null],
        ['nivel' => 'global', 'datos' => $global]
    ];
    foreach ($candidatos as $candidato) {
        $datos = $candidato['datos'];
        if (
            $datos !== null
            && $datos['total'] >= 5
            && $datos['n_latencia'] >= 2
            && $datos['n_ancho_banda'] >= 2
        ) {
            $estadisticasPorDispositivo[$idDispositivo] = [
                'disponible' => true,
                'origen' => $candidato['nivel'],
                'total' => $datos['total'],
                'conectados' => $datos['conectados'],
                'probabilidad_conectado' => ($datos['conectados'] + 1) / ($datos['total'] + 2),
                'n_latencia' => $datos['n_latencia'],
                'media_latencia' => $datos['media_latencia'],
                'desviacion_latencia' => $datos['desviacion_latencia'] ?? 0.0,
                'n_ancho_banda' => $datos['n_ancho_banda'],
                'media_ancho_banda' => $datos['media_ancho_banda'],
                'desviacion_ancho_banda' => $datos['desviacion_ancho_banda'] ?? 0.0
            ];
            break;
        }
    }
}

echo json_encode([
    'success' => true,
    'origen' => 'bd',
    'estadisticas' => $estadisticasPorDispositivo
]);
