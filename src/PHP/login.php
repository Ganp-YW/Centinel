<?php

include __DIR__ . "/../BD/DBConn.php";



header('Content-Type: application/json');

function responder($success, $message, $datosExtra = [])
{
    $respuesta = array_merge([
        'success' => $success,
        'message' => $message
    ], $datosExtra);

    echo json_encode($respuesta);

    exit;
}

function buscarUsuario($conexion, $identificador)
{
    $sql = "SELECT id_usuario, name_usu, email, passw, type
                FROM usuario
                WHERE name_usu = ? OR email = ?
                LIMIT 1";

    $stmt = $conexion->prepare($sql);
    $stmt->bind_param("ss", $identificador, $identificador);
    $stmt->execute();
    $result = $stmt->get_result();

    return $result->fetch_assoc(); // Retorna el registro o null si no existe
}

function verificarPassword($passwordIngresada, $passwordBD)
{
    // Comparación directa para texto plano (ej: "1234")
    return $passwordIngresada === $passwordBD;
}


$usuarioCorreo = trim($_POST["usuario_correo"] ?? '');
$password = trim($_POST["password"] ?? '');


if (empty($usuarioCorreo) || empty($password)) {
    responder(false, "Por favor completa todos los campos.");
}

$usuario = buscarUsuario($conexion, $usuarioCorreo);

if (!$usuario) {
    responder(false, "Usuario o contraseña incorrectos.");
}

if (!verificarPassword($password, $usuario['passw'])) {
    responder(false, "Usuario o contraseña incorrectos.");
}

session_start();

$_SESSION['id_usuario'] = $usuario['id_usuario'];
$_SESSION['name_usu']   = $usuario['name_usu'];
$_SESSION['email']      = $usuario['email'];
$_SESSION['type']       = $usuario['type'];

// Redirección al panel de control general
$rutaDestino = 'src/Vistas/Panel de control.html';

responder(true, "Inicio de sesión exitoso.", [
    'redirect' => $rutaDestino,
    'rol'      => $usuario['type'],
    'usuario'  => [
        'id'     => $usuario['id_usuario'],
        'nombre' => $usuario['name_usu'],
        'email'  => $usuario['email'],
        'rol'    => $usuario['type']
    ]
]);

