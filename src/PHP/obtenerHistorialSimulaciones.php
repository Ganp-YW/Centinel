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

$pagina = filter_var($_GET['pagina'] ?? 1, FILTER_VALIDATE_INT);
$porPagina = filter_var($_GET['por_pagina'] ?? 25, FILTER_VALIDATE_INT);
$sede = trim($_GET['sede'] ?? 'todas');
if ($pagina === false || $pagina < 1 || $porPagina === false || $porPagina < 1 || $porPagina > 100) {
    http_response_code(422);
    echo json_encode(['success' => false, 'mensaje' => 'Los parámetros de paginación no son válidos.']);
    exit;
}

$offset = ($pagina - 1) * $porPagina;
$rutaConexion = __DIR__ . '/../BD/DBConn.php';
if (file_exists($rutaConexion)) {
    @include $rutaConexion;
}

if (isset($conexion) && $conexion instanceof mysqli && !$conexion->connect_error) {
    require_once __DIR__ . '/../Modelos/Simulacion.php';
    try {
        $total = Simulacion::contarHistorial($conexion, $sede);
        $paginas = max(1, (int) ceil($total / $porPagina));
        if ($pagina > $paginas) {
            http_response_code(422);
            echo json_encode(['success' => false, 'mensaje' => 'La página solicitada está fuera del rango del historial.']);
            exit;
        }

        $historial = array_map(
            static fn(Simulacion $simulacion): array => $simulacion->toArray(),
            Simulacion::listarHistorial($conexion, $porPagina, $offset, $sede)
        );
        echo json_encode([
            'success' => true,
            'origen' => 'bd',
            'simulaciones' => $historial,
            'paginacion' => [
                'pagina' => $pagina,
                'por_pagina' => $porPagina,
                'total' => $total,
                'paginas' => $paginas
            ]
        ]);
        exit;
    } catch (Throwable $error) {
        error_log('No se pudo consultar el historial de simulaciones: ' . $error->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'mensaje' => 'No se pudo consultar el historial en la base de datos.']);
        exit;
    }
}

$historial = $_SESSION['historialSimulacionesDemo'] ?? [];
if ($sede !== '' && strtolower($sede) !== 'todas') {
    $historial = array_values(array_filter(
        $historial,
        static fn(array $simulacion): bool => strcasecmp($simulacion['sede'] ?? '', $sede) === 0
    ));
}
usort($historial, static fn(array $a, array $b): int => strcmp($b['fecha_registro'], $a['fecha_registro']));
$total = count($historial);
$paginas = max(1, (int) ceil($total / $porPagina));
if ($pagina > $paginas) {
    http_response_code(422);
    echo json_encode(['success' => false, 'mensaje' => 'La página solicitada está fuera del rango del historial.']);
    exit;
}

echo json_encode([
    'success' => true,
    'origen' => 'memoria',
    'simulaciones' => array_slice($historial, $offset, $porPagina),
    'paginacion' => [
        'pagina' => $pagina,
        'por_pagina' => $porPagina,
        'total' => $total,
        'paginas' => $paginas
    ]
]);
