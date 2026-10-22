<?php 

// Credenciales

$host = "localhost";
$usuario = "root"; 
$password = "";
$bd = "centinel";

$conexion = mysqli_connect($host, $usuario, $password, $bd);

if(!$conexion){
    die("Error: ".mysqli_connect_error());
}

?>