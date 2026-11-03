<?php 

// Credenciales

$host = "localhost";
$usuario = "root"; 
$password = "";
$bd = "centinel";

mysqli_report(MYSQLI_REPORT_OFF);
$conexion = @mysqli_connect($host, $usuario, $password, $bd);

?>