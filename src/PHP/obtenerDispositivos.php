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
        $sql = "SELECT d.id_dispositivo, d.name_dispositivo, d.ip_dispositivo, d.status, 
                       d.BW_dispositivo, d.latencia_dispositivo, d.fecha, 
                       COALESCE(s.name_sede, 'Sin Asignar') AS sede
                FROM dispositivo d
                LEFT JOIN sede_dispositivo sd ON d.id_dispositivo = sd.id_dispositivo
                LEFT JOIN sede s ON sd.id_sede = s.id_sede";
        
        if (!empty($sedeFiltro) && strtolower($sedeFiltro) !== 'todas') {
            $sedeSegura = mysqli_real_escape_string($conexion, $sedeFiltro);
            $sql .= " WHERE LOWER(s.name_sede) = LOWER('{$sedeSegura}')";
        }
        $sql .= " ORDER BY d.id_dispositivo ASC";

        $res = @mysqli_query($conexion, $sql);
        if ($res && mysqli_num_rows($res) > 0) {
            $dispositivosBD = [];
            while ($fila = mysqli_fetch_assoc($res)) {
                $fila['status'] = (int) $fila['status'];
                $fila['BW_dispositivo'] = (float) $fila['BW_dispositivo'];
                $fila['latencia_dispositivo'] = (int) $fila['latencia_dispositivo'];
                $dispositivosBD[] = $fila;
            }

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
    // Si ocurre un error, continuar con datos por defecto
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

