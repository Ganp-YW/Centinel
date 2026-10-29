<?php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

header('Content-Type: application/json');

if (!isset($_SESSION['id_usuario'])) {
    echo json_encode([
        'autenticado' => false,
        'mensaje'     => 'No hay sesión activa.'
    ]);
    exit;
}

echo json_encode([
    'autenticado' => true,
    'usuario'     => [
        'id'     => $_SESSION['id_usuario'],
        'nombre' => $_SESSION['name_usu'],
        'email'  => $_SESSION['email'] ?? '',
        'rol'    => $_SESSION['type']
    ]
]);
