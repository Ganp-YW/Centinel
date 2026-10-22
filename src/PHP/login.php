<?php

include __DIR__ . "/../BD/DBConn.php";


$usuarioCorreo = $_POST["usuario_correo"];

$password = $_POST["password"];

$SQLgerente = "SELECT * FROM `usuario` WHERE type = 'Gerente'";

$SQLtecnico = "SELECT * FROM `usuario` WHERE type = 'Tecnico'";

$filaGerente = mysqli_query($conexion, $SQLgerente);
$filaGerente = mysqli_fetch_assoc($filaGerente);

$filaTecnico = mysqli_query($conexion, $SQLtecnico);
$filaTecnico = mysqli_fetch_assoc($filaTecnico);

echo "Tipo de Usuario: " . $filaGerente['type'] . "<br>";
echo "Tipo de Usuario: " . $filaTecnico['type'];
