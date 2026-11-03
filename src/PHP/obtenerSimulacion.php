<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

if (!in_array($_SESSION['type'] ?? '', ['Tecnico', 'Técnico'], true)) {
    http_response_code(isset($_SESSION['type']) ? 403 : 401);
    echo json_encode(['success' => false, 'mensaje' => 'Acceso permitido únicamente para usuarios Técnico.']);
    exit;
}

// Datos mock realistas para 8 dispositivos
$dispositivosMock = [
    [
        'id_dispositivo'  => 1,
        'name_dispositivo' => 'Router Principal',
        'ip_dispositivo'  => '192.168.1.1',
        'sede'            => 'Miranda',
        'conectividad'    => 1,
        'latencia'        => 12.5,
        'ancho_banda'     => 100.0,
        'modo'            => 'automatico',
        'fecha_registro'  => '2026-10-29 14:30:00'
    ],
    [
        'id_dispositivo'  => 2,
        'name_dispositivo' => 'Switch Piso 2',
        'ip_dispositivo'  => '192.168.1.14',
        'sede'            => 'Aragua',
        'conectividad'    => 0,
        'latencia'        => 0.0,
        'ancho_banda'     => 0.0,
        'modo'            => 'manual',
        'fecha_registro'  => '2026-10-29 14:30:00'
    ],
    [
        'id_dispositivo'  => 3,
        'name_dispositivo' => 'Firewall Perimetral',
        'ip_dispositivo'  => '192.168.1.254',
        'sede'            => 'Miranda',
        'conectividad'    => 1,
        'latencia'        => 8.1,
        'ancho_banda'     => 500.0,
        'modo'            => 'automatico',
        'fecha_registro'  => '2026-10-29 14:32:15'
    ],
    [
        'id_dispositivo'  => 4,
        'name_dispositivo' => 'Switch Core Aragua',
        'ip_dispositivo'  => '192.168.2.1',
        'sede'            => 'Aragua',
        'conectividad'    => 1,
        'latencia'        => 15.3,
        'ancho_banda'     => 1000.0,
        'modo'            => 'automatico',
        'fecha_registro'  => '2026-10-29 14:33:40'
    ],
    [
        'id_dispositivo'  => 5,
        'name_dispositivo' => 'Servidor DNS/DHCP',
        'ip_dispositivo'  => '192.168.2.10',
        'sede'            => 'Aragua',
        'conectividad'    => 1,
        'latencia'        => 4.7,
        'ancho_banda'     => 100.0,
        'modo'            => 'automatico',
        'fecha_registro'  => '2026-10-29 14:34:22'
    ],
    [
        'id_dispositivo'  => 6,
        'name_dispositivo' => 'Router Borde Táchira',
        'ip_dispositivo'  => '192.168.3.1',
        'sede'            => 'Táchira',
        'conectividad'    => 1,
        'latencia'        => 24.8,
        'ancho_banda'     => 200.0,
        'modo'            => 'manual',
        'fecha_registro'  => '2026-10-29 14:35:10'
    ],
    [
        'id_dispositivo'  => 7,
        'name_dispositivo' => 'Access Point Planta 1',
        'ip_dispositivo'  => '192.168.3.20',
        'sede'            => 'Táchira',
        'conectividad'    => 0,
        'latencia'        => 0.0,
        'ancho_banda'     => 0.0,
        'modo'            => 'manual',
        'fecha_registro'  => '2026-10-29 14:35:50'
    ],
    [
        'id_dispositivo'  => 8,
        'name_dispositivo' => 'Servidor de Respaldos',
        'ip_dispositivo'  => '192.168.1.50',
        'sede'            => 'Miranda',
        'conectividad'    => 1,
        'latencia'        => 11.2,
        'ancho_banda'     => 300.0,
        'modo'            => 'automatico',
        'fecha_registro'  => '2026-10-29 14:36:30'
    ]
];

$sedeFiltro = trim($_GET['sede'] ?? '');

try {
    $rutaConexion = __DIR__ . "/../BD/DBConn.php";
    if (file_exists($rutaConexion)) {
        @include $rutaConexion;
    }

    if (isset($conexion) && $conexion instanceof mysqli && !$conexion->connect_error) {
        require_once __DIR__ . '/../Modelos/Simulacion.php';
        $dispositivosBD = array_map(
            static fn(Simulacion $simulacion): array => $simulacion->toArray(),
            Simulacion::ultimasPorDispositivo($conexion, $sedeFiltro)
        );

        if (count($dispositivosBD) > 0) {
            echo json_encode([
                'success'      => true,
                'origen'       => 'bd',
                'dispositivos' => $dispositivosBD
            ]);
            exit;
        }
    }
} catch (Throwable $e) {
    error_log('No se pudo consultar la última simulación desde la base de datos: ' . $e->getMessage());
}

// Filtrar datos mock por sede si se proporcionó el parámetro
$resultado = $dispositivosMock;
if (!empty($sedeFiltro) && strtolower($sedeFiltro) !== 'todas') {
    $resultado = array_values(array_filter($resultado, function ($item) use ($sedeFiltro) {
        return strcasecmp($item['sede'], $sedeFiltro) === 0;
    }));
}

echo json_encode([
    'success'      => true,
    'origen'       => 'memoria',
    'dispositivos' => $resultado
]);
