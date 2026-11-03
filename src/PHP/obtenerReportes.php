<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

if (($_SESSION['type'] ?? '') !== 'Gerente') {
    http_response_code(403);
    echo json_encode(['success' => false, 'mensaje' => 'Acceso permitido únicamente para usuarios Gerente.']);
    exit;
}

$tipo       = strtolower(trim($_GET['tipo'] ?? 'sede'));
$sedeFiltro = trim($_GET['sede'] ?? '');
$mesesParam = trim($_GET['meses'] ?? '');

// Parsear meses solicitados
$mesesSolicitados = [];
if (!empty($mesesParam)) {
    $mesesSolicitados = array_map('trim', explode(',', $mesesParam));
    // Validar formato YYYY-MM
    $mesesSolicitados = array_filter($mesesSolicitados, function ($m) {
        return preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $m);
    });
    $mesesSolicitados = array_values(array_unique($mesesSolicitados));
}

// Si no se proporcionaron meses, usar el mes actual
if (empty($mesesSolicitados)) {
    $mesesSolicitados = [date('Y-m')];
}

$usoBD = false;
$datosRespuesta = [];

try {
    $rutaConexion = __DIR__ . "/../BD/DBConn.php";
    if (file_exists($rutaConexion)) {
        @include $rutaConexion;
    }

    if (isset($conexion) && $conexion instanceof mysqli && !$conexion->connect_error) {
        require_once __DIR__ . '/../Modelos/Reporte.php';
        foreach ($mesesSolicitados as $mes) {
            $reportesMes = Reporte::obtenerPorMes(
                $conexion,
                $tipo,
                $sedeFiltro,
                $mes
            );
            if (count($reportesMes) > 0) {
                $usoBD = true;
                $labels         = [];
                $disponibilidad = [];
                $latenciaP      = [];
                $consumoT       = [];

                foreach ($reportesMes as $reporte) {
                    $fila = $reporte->toArray();
                    $labels[]         = $fila['etiqueta'];
                    $disponibilidad[] = $fila['disponibilidad'];
                    $latenciaP[]      = $fila['latencia_promedio'];
                    $consumoT[]       = $fila['consumo_total'];
                }

                $datosRespuesta[$mes] = [
                    'labels'           => $labels,
                    'disponibilidad'   => $disponibilidad,
                    'latencia_promedio' => $latenciaP,
                    'consumo_total'    => $consumoT
                ];
            }
        }

        // Si la BD funcionó y hay datos, responder
        if ($usoBD && count($datosRespuesta) === count($mesesSolicitados)) {
            echo json_encode([
                'success' => true,
                'origen' => 'bd',
                'tipo'    => $tipo,
                'meses'   => $mesesSolicitados,
                'datos'   => $datosRespuesta
            ]);
            exit;
        }
    }
} catch (Throwable $e) {
    error_log('No se pudo consultar el reporte desde la base de datos: ' . $e->getMessage());
}

// ─── DATOS MOCK REALISTAS ────────────────────────────────────────────────────

// Dispositivos por sede para datos mock
$dispositivosPorSede = [
    'Miranda' => [
        'Router Principal',
        'Firewall Perimetral',
        'Servidor de Respaldos'
    ],
    'Aragua' => [
        'Switch Piso 2',
        'Switch Core Aragua',
        'Servidor DNS/DHCP'
    ],
    'Táchira' => [
        'Router Borde Táchira',
        'Access Point Planta 1'
    ]
];

// Generar datos mock para cada mes
$datosMock = [];

foreach ($mesesSolicitados as $indice => $mes) {
    // Variación leve entre meses para que los gráficos se vean interesantes
    $variacion = ($indice + 1) * 1.5;

    if ($tipo === 'global') {
        // Datos agrupados por sede
        $datosMock[$mes] = [
            'labels'           => ['Miranda', 'Aragua', 'Táchira'],
            'disponibilidad'   => [
                round(98.5 - $variacion * 0.3, 1),
                round(94.2 + $variacion * 0.5, 1),
                round(91.8 + $variacion * 0.8, 1)
            ],
            'latencia_promedio' => [
                round(10.6 + $variacion * 0.4, 1),
                round(6.8 + $variacion * 0.2, 1),
                round(12.4 - $variacion * 0.3, 1)
            ],
            'consumo_total'    => [
                round(27800 + $variacion * 320, 1),
                round(33600 - $variacion * 210, 1),
                round(6400 + $variacion * 150, 1)
            ]
        ];
    } else {
        // Datos por dispositivo, filtrar por sede si corresponde
        $sedeActual = (!empty($sedeFiltro) && strtolower($sedeFiltro) !== 'todas')
            ? $sedeFiltro
            : '';

        $labels         = [];
        $disponibilidad = [];
        $latenciaP      = [];
        $consumoT       = [];

        // Valores base por dispositivo
        $valoresBase = [
            'Router Principal'      => ['disp' => 98.5, 'lat' => 12.3, 'bw' => 3200],
            'Firewall Perimetral'   => ['disp' => 100.0, 'lat' => 8.1, 'bw' => 15000],
            'Servidor de Respaldos' => ['disp' => 95.2, 'lat' => 11.5, 'bw' => 9600],
            'Switch Piso 2'         => ['disp' => 87.3, 'lat' => 0.0, 'bw' => 0],
            'Switch Core Aragua'    => ['disp' => 99.1, 'lat' => 15.3, 'bw' => 30000],
            'Servidor DNS/DHCP'     => ['disp' => 99.8, 'lat' => 4.7, 'bw' => 3600],
            'Router Borde Táchira'  => ['disp' => 96.4, 'lat' => 24.8, 'bw' => 6000],
            'Access Point Planta 1' => ['disp' => 78.9, 'lat' => 0.0, 'bw' => 400]
        ];

        foreach ($dispositivosPorSede as $sede => $dispositivos) {
            // Filtrar por sede si se proporcionó
            if (!empty($sedeActual) && strcasecmp($sede, $sedeActual) !== 0) {
                continue;
            }

            foreach ($dispositivos as $nombre) {
                $base = $valoresBase[$nombre];
                $labels[]         = $nombre;
                $disponibilidad[] = round(min(100, max(0, $base['disp'] + ($variacion * 0.2 * (rand(-10, 10) / 10)))), 1);
                $latenciaP[]      = round(max(0, $base['lat'] + ($variacion * 0.3 * (rand(-5, 5) / 10))), 1);
                $consumoT[]       = round(max(0, $base['bw'] + ($variacion * 50 * (rand(-5, 5) / 10))), 1);
            }
        }

        $datosMock[$mes] = [
            'labels'           => $labels,
            'disponibilidad'   => $disponibilidad,
            'latencia_promedio' => $latenciaP,
            'consumo_total'    => $consumoT
        ];
    }
}

echo json_encode([
    'success' => true,
    'origen'  => 'memoria',
    'tipo'    => $tipo,
    'meses'   => $mesesSolicitados,
    'datos'   => $datosMock
]);
