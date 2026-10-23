<?php
// Este codigo sirve para generar una API de las bases de datos, para que JS se conecte y pueda acceder a ella.

include __DIR__ . "/DBConn.php";

header('Content-type: application/json');

$sql = "SELECT * FROM usuarios";

$r = mysqli_query($conexion, $sql);

if ($r) {
    $datos = array();
    while ($fila = mysqli_fetch_assoc($r)) {
        $datos[] = $fila;
    }
}
