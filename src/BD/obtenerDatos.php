<?php
// Este codigo sirve para generar una API de las bases de datos, para que JS se conecte y pueda acceder a ella.

include __DIR__ . "/DBConn.php";

header('Content-Type: application/json; charset=utf-8');

$sql = "SELECT id_usuario, name_usu, email, type FROM usuario";

$r = @mysqli_query($conexion, $sql);

$datos = array();
if ($r) {
    while ($fila = mysqli_fetch_assoc($r)) {
        $datos[] = $fila;
    }
}

echo json_encode($datos);
