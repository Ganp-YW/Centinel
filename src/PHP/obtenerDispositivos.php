<?php
header('Content-Type: application/json; charset=utf-8');

// Datos base por defecto para garantizar funcionamiento inmediato
$dispositivosPorDefecto = [
    [
        'id_dispositivo' => 1,
        'name_dispositivo' => 'Router Principal',
        'ip_dispositivo' => '192.168.1.1',
        'status' => 1,
        'BW_dispositivo' => 100.0,
        'latencia_dispositivo' => 12,
        'fecha' => '2026-10-22',
        'sede' => 'Miranda'
    ],
    [
        'id_dispositivo' => 2,
        'name_dispositivo' => 'Switch Piso 2',
        'ip_dispositivo' => '192.168.1.14',
        'status' => 0,
        'BW_dispositivo' => 0.0,
        'latencia_dispositivo' => 0,
        'fecha' => '2026-10-22',
        'sede' => 'Aragua'
    ],
    [
        'id_dispositivo' => 3,
        'name_dispositivo' => 'Firewall Perimetral',
        'ip_dispositivo' => '192.168.1.254',
        'status' => 1,
        'BW_dispositivo' => 500.0,
        'latencia_dispositivo' => 8,
        'fecha' => '2026-10-23',
        'sede' => 'Miranda'
    ],
    [
        'id_dispositivo' => 4,
        'name_dispositivo' => 'Switch Core Aragua',
        'ip_dispositivo' => '192.168.2.1',
        'status' => 1,
        'BW_dispositivo' => 1000.0,
        'latencia_dispositivo' => 15,
        'fecha' => '2026-10-24',
        'sede' => 'Aragua'
    ],
    [
        'id_dispositivo' => 5,
        'name_dispositivo' => 'Servidor DNS/DHCP',
        'ip_dispositivo' => '192.168.2.10',
        'status' => 1,
        'BW_dispositivo' => 100.0,
        'latencia_dispositivo' => 5,
        'fecha' => '2026-10-24',
        'sede' => 'Aragua'
    ],
    [
        'id_dispositivo' => 6,
        'name_dispositivo' => 'Router Borde Táchira',
        'ip_dispositivo' => '192.168.3.1',
        'status' => 1,
        'BW_dispositivo' => 200.0,
        'latencia_dispositivo' => 24,
        'fecha' => '2026-10-25',
        'sede' => 'Táchira'
    ],
    [
        'id_dispositivo' => 7,
        'name_dispositivo' => 'Access Point Planta 1',
        'ip_dispositivo' => '192.168.3.20',
        'status' => 0,
        'BW_dispositivo' => 0.0,
        'latencia_dispositivo' => 0,
        'fecha' => '2026-10-25',
        'sede' => 'Táchira'
    ],
    [
        'id_dispositivo' => 8,
        'name_dispositivo' => 'Servidor de Respaldos',
        'ip_dispositivo' => '192.168.1.50',
        'status' => 1,
        'BW_dispositivo' => 300.0,
        'latencia_dispositivo' => 11,
        'fecha' => '2026-10-26',
        'sede' => 'Miranda'
    ]
];

$sedeFiltro = trim($_GET['sede'] ?? '');

try {
    $rutaConexion = __DIR__ . "/../BD/DBConn.php";
    if (file_exists($rutaConexion)) {
        @include $rutaConexion;
    }

    if (isset($conexion) && $conexion instanceof mysqli && !$conexion->connect_error) {
        require_once __DIR__ . '/../Modelos/Dispositivo.php';
        $dispositivosBD = array_map(
            static fn(Dispositivo $dispositivo): array => $dispositivo->toArray(),
            Dispositivo::listar($conexion, $sedeFiltro)
        );

        if (count($dispositivosBD) > 0) {
            echo json_encode([
                'success' => true,
                'origen'  => 'bd',
                'total'   => count($dispositivosBD),
                'dispositivos' => $dispositivosBD
            ]);
            exit;
        }
    }
} catch (Throwable $e) {
    error_log('No se pudo consultar el inventario de dispositivos: ' . $e->getMessage());
}

// Filtrar datos por defecto si se especificó sede
$resultado = $dispositivosPorDefecto;
if (!empty($sedeFiltro) && strtolower($sedeFiltro) !== 'todas') {
    $resultado = array_values(array_filter($resultado, function($item) use ($sedeFiltro) {
        return strcasecmp($item['sede'], $sedeFiltro) === 0;
    }));
}

echo json_encode([
    'success' => true,
    'origen'  => 'memoria',
    'total'   => count($resultado),
    'dispositivos' => $resultado
]);
