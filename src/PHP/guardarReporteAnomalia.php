<?php
header('Content-Type: application/json; charset=utf-8');

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$rol = $_SESSION['type'] ?? '';
$idUsuario = filter_var($_SESSION['id_usuario'] ?? null, FILTER_VALIDATE_INT);
if ($idUsuario === false || $idUsuario === null || !in_array($rol, ['Gerente', 'Tecnico', 'Técnico'], true)) {
    http_response_code(isset($_SESSION['id_usuario']) ? 403 : 401);
    echo json_encode(['success' => false, 'mensaje' => 'Se requiere una sesión de Gerente o Técnico.']);
    exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'mensaje' => 'Método no permitido. Use POST.']);
    exit;
}

$datos = json_decode(file_get_contents('php://input'), true);
if (!is_array($datos)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'mensaje' => 'El cuerpo debe contener un objeto JSON válido.']);
    exit;
}

$esGerente = $rol === 'Gerente';
$accion = $datos['accion'] ?? '';
$estados = ['pendiente', 'en_revision', 'resuelto'];
if (!$esGerente) {
    if ($accion !== 'estado' || !in_array($datos['estado'] ?? '', $estados, true)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'mensaje' => 'El técnico solo puede actualizar el estado de revisión.']);
        exit;
    }
} elseif (!in_array($accion, ['crear', 'editar'], true)) {
    http_response_code(422);
    echo json_encode(['success' => false, 'mensaje' => 'Acción de reporte inválida.']);
    exit;
}

require_once __DIR__ . '/../BD/DBConn.php';
if (!isset($conexion) || !$conexion instanceof mysqli || $conexion->connect_error) {
    http_response_code(503);
    echo json_encode(['success' => false, 'mensaje' => 'No se pudo guardar el reporte en la base de datos.']);
    exit;
}
if (!$conexion->set_charset('utf8mb4')) {
    error_log('No se pudo configurar UTF-8 para guardar reportes de anomalías: ' . $conexion->error);
    http_response_code(500);
    echo json_encode(['success' => false, 'mensaje' => 'No se pudo preparar la codificación de los reportes.']);
    exit;
}

function responderErrorReporte(int $codigo, string $mensaje): never
{
    http_response_code($codigo);
    echo json_encode(['success' => false, 'mensaje' => $mensaje]);
    exit;
}

function longitudTextoReporte(string $texto): int
{
    $cantidad = preg_match_all('/./us', $texto);
    return $cantidad === false ? PHP_INT_MAX : $cantidad;
}

function textoReporte(mixed $valor): string
{
    return is_string($valor) ? trim($valor) : '';
}

function obtenerObjetivoReporte(mysqli $conexion, array $datos): array
{
    $tipo = $datos['tipo_objetivo'] ?? '';
    if ($tipo === 'sede') {
        $idSede = filter_var($datos['id_sede'] ?? null, FILTER_VALIDATE_INT);
        if ($idSede === false || $idSede < 1) {
            responderErrorReporte(422, 'Selecciona una sede válida.');
        }
        $stmt = $conexion->prepare('SELECT name_sede FROM sede WHERE id_sede = ?');
        if (!$stmt) {
            throw new RuntimeException('No se pudo preparar la consulta de sede.');
        }
        $stmt->bind_param('i', $idSede);
        if (!$stmt->execute()) {
            throw new RuntimeException('No se pudo consultar la sede.');
        }
        $fila = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        if (!$fila) {
            responderErrorReporte(422, 'La sede seleccionada ya no existe.');
        }
        return [
            'tipo_objetivo' => 'sede',
            'id_sede' => $idSede,
            'id_dispositivo' => null,
            'nombre_objetivo' => $fila['name_sede'],
            'ip_objetivo' => null
        ];
    }

    if ($tipo === 'dispositivo') {
        $idDispositivo = filter_var($datos['id_dispositivo'] ?? null, FILTER_VALIDATE_INT);
        if ($idDispositivo === false || $idDispositivo < 1) {
            responderErrorReporte(422, 'Selecciona un dispositivo válido.');
        }
        $stmt = $conexion->prepare(
            'SELECT d.name_dispositivo, d.ip_dispositivo, sd.id_sede
             FROM dispositivo d
             LEFT JOIN sede_dispositivo sd ON sd.id_dispositivo = d.id_dispositivo
             WHERE d.id_dispositivo = ?
             LIMIT 1'
        );
        if (!$stmt) {
            throw new RuntimeException('No se pudo preparar la consulta del dispositivo.');
        }
        $stmt->bind_param('i', $idDispositivo);
        if (!$stmt->execute()) {
            throw new RuntimeException('No se pudo consultar el dispositivo.');
        }
        $fila = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        if (!$fila) {
            responderErrorReporte(422, 'El dispositivo seleccionado ya no existe.');
        }
        return [
            'tipo_objetivo' => 'dispositivo',
            'id_sede' => $fila['id_sede'] !== null ? (int) $fila['id_sede'] : null,
            'id_dispositivo' => $idDispositivo,
            'nombre_objetivo' => $fila['name_dispositivo'],
            'ip_objetivo' => $fila['ip_dispositivo']
        ];
    }

    responderErrorReporte(422, 'El objetivo debe ser una sede o un dispositivo.');
}

function obtenerDatosReporte(mysqli $conexion, int $idReporte, bool $bloquear = false): array
{
    $sql = 'SELECT tipo_objetivo, id_sede, id_dispositivo, nombre_objetivo, ip_objetivo,
                   tipo_error, titulo, detalles, prioridad, estado, fecha_evento
            FROM reporte_anomalia WHERE id_reporte = ?' . ($bloquear ? ' FOR UPDATE' : '');
    $stmt = $conexion->prepare($sql);
    if (!$stmt) {
        throw new RuntimeException('No se pudo preparar la consulta del reporte.');
    }
    $stmt->bind_param('i', $idReporte);
    if (!$stmt->execute()) {
        throw new RuntimeException('No se pudo consultar el reporte.');
    }
    $fila = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$fila) {
        responderErrorReporte(404, 'El reporte solicitado no existe.');
    }
    return $fila;
}

function guardarEventoReporte(
    mysqli $conexion,
    int $idReporte,
    int $idUsuario,
    string $nombreUsuario,
    string $accion,
    ?array $anteriores,
    array $nuevos
): void {
    $antesJson = $anteriores === null ? null : json_encode($anteriores, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    $despuesJson = json_encode($nuevos, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    $stmt = $conexion->prepare(
        'INSERT INTO historial_reporte_anomalia
         (id_reporte, id_usuario, nombre_usuario, accion, datos_anteriores, datos_nuevos)
         VALUES (?, ?, ?, ?, ?, ?)'
    );
    if (!$stmt) {
        throw new RuntimeException('No se pudo preparar el registro de auditoría.');
    }
    $stmt->bind_param('iissss', $idReporte, $idUsuario, $nombreUsuario, $accion, $antesJson, $despuesJson);
    if (!$stmt->execute()) {
        throw new RuntimeException('No se pudo registrar la auditoría del reporte.');
    }
    $stmt->close();
}

try {
    $idReporte = null;
    $anteriores = null;
    if ($accion === 'editar' || $accion === 'estado') {
        $idReporte = filter_var($datos['id_reporte'] ?? null, FILTER_VALIDATE_INT);
        if ($idReporte === false || $idReporte < 1) {
            responderErrorReporte(422, 'Identificador de reporte inválido.');
        }
    }

    if (!$conexion->begin_transaction()) {
        throw new RuntimeException('No se pudo iniciar la transacción del reporte.');
    }
    if ($accion === 'crear') {
        $tipoError = textoReporte($datos['tipo_error'] ?? null);
        $titulo = textoReporte($datos['titulo'] ?? null);
        $detalles = textoReporte($datos['detalles'] ?? null);
        $prioridad = $datos['prioridad'] ?? '';
        $estado = $datos['estado'] ?? 'pendiente';
        $fechaEntrada = is_string($datos['fecha_evento'] ?? null) ? $datos['fecha_evento'] : '';
        $fechaObjeto = DateTime::createFromFormat('!Y-m-d\TH:i', $fechaEntrada);
        $erroresFecha = DateTime::getLastErrors();
        if (
            $tipoError === '' || longitudTextoReporte($tipoError) > 80
            || $titulo === '' || longitudTextoReporte($titulo) > 180
            || $detalles === '' || longitudTextoReporte($detalles) > 10000
            || !in_array($prioridad, ['baja', 'media', 'alta', 'critica'], true)
            || !in_array($estado, $estados, true)
            || !$fechaObjeto
            || ($erroresFecha !== false && ($erroresFecha['warning_count'] || $erroresFecha['error_count']))
        ) {
            responderErrorReporte(422, 'Revisa el tipo de error, título, detalles, prioridad, estado y fecha/hora del evento.');
        }

        $objetivo = obtenerObjetivoReporte($conexion, $datos);
        $fechaEvento = $fechaObjeto->format('Y-m-d H:i:s');
        $nombreCreador = (string) ($_SESSION['name_usu'] ?? 'Usuario');
        $stmt = $conexion->prepare(
            'INSERT INTO reporte_anomalia
             (tipo_objetivo, id_sede, id_dispositivo, nombre_objetivo, ip_objetivo,
              tipo_error, titulo, detalles, prioridad, estado, fecha_evento, id_creador, nombre_creador)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        if (!$stmt) {
            throw new RuntimeException('No se pudo preparar el nuevo reporte.');
        }
        $stmt->bind_param(
            'siissssssssis',
            $objetivo['tipo_objetivo'],
            $objetivo['id_sede'],
            $objetivo['id_dispositivo'],
            $objetivo['nombre_objetivo'],
            $objetivo['ip_objetivo'],
            $tipoError,
            $titulo,
            $detalles,
            $prioridad,
            $estado,
            $fechaEvento,
            $idUsuario,
            $nombreCreador
        );
        if (!$stmt->execute()) {
            throw new RuntimeException('No se pudo guardar el reporte.');
        }
        $idReporte = (int) $conexion->insert_id;
        $stmt->close();
        $nuevos = obtenerDatosReporte($conexion, $idReporte);
        $accionHistorial = 'creado';
    } elseif ($accion === 'editar') {
        $anteriores = obtenerDatosReporte($conexion, $idReporte, true);
        $tipoError = textoReporte($datos['tipo_error'] ?? null);
        $titulo = textoReporte($datos['titulo'] ?? null);
        $detalles = textoReporte($datos['detalles'] ?? null);
        $prioridad = $datos['prioridad'] ?? '';
        $estado = $datos['estado'] ?? '';
        $fechaEntrada = is_string($datos['fecha_evento'] ?? null) ? $datos['fecha_evento'] : '';
        $fechaObjeto = DateTime::createFromFormat('!Y-m-d\TH:i', $fechaEntrada);
        $erroresFecha = DateTime::getLastErrors();
        if (
            $tipoError === '' || longitudTextoReporte($tipoError) > 80
            || $titulo === '' || longitudTextoReporte($titulo) > 180
            || $detalles === '' || longitudTextoReporte($detalles) > 10000
            || !in_array($prioridad, ['baja', 'media', 'alta', 'critica'], true)
            || !in_array($estado, $estados, true)
            || !$fechaObjeto
            || ($erroresFecha !== false && ($erroresFecha['warning_count'] || $erroresFecha['error_count']))
        ) {
            responderErrorReporte(422, 'Revisa los datos del reporte antes de guardar los cambios.');
        }

        $objetivo = obtenerObjetivoReporte($conexion, $datos);
        $fechaEvento = $fechaObjeto->format('Y-m-d H:i:s');
        $stmt = $conexion->prepare(
            'UPDATE reporte_anomalia
             SET tipo_objetivo = ?, id_sede = ?, id_dispositivo = ?, nombre_objetivo = ?,
                 ip_objetivo = ?, tipo_error = ?, titulo = ?, detalles = ?, prioridad = ?,
                 estado = ?, fecha_evento = ?
             WHERE id_reporte = ?'
        );
        if (!$stmt) {
            throw new RuntimeException('No se pudo preparar la edición del reporte.');
        }
        $stmt->bind_param(
            'siissssssssi',
            $objetivo['tipo_objetivo'],
            $objetivo['id_sede'],
            $objetivo['id_dispositivo'],
            $objetivo['nombre_objetivo'],
            $objetivo['ip_objetivo'],
            $tipoError,
            $titulo,
            $detalles,
            $prioridad,
            $estado,
            $fechaEvento,
            $idReporte
        );
        if (!$stmt->execute()) {
            throw new RuntimeException('No se pudo actualizar el reporte.');
        }
        $stmt->close();
        $nuevos = obtenerDatosReporte($conexion, $idReporte);
        $accionHistorial = 'editado';
    } else {
        $anteriores = obtenerDatosReporte($conexion, $idReporte, true);
        $estado = $datos['estado'];
        $stmt = $conexion->prepare('UPDATE reporte_anomalia SET estado = ? WHERE id_reporte = ?');
        if (!$stmt) {
            throw new RuntimeException('No se pudo preparar la actualización del estado.');
        }
        $stmt->bind_param('si', $estado, $idReporte);
        if (!$stmt->execute()) {
            throw new RuntimeException('No se pudo actualizar el estado del reporte.');
        }
        $stmt->close();
        $nuevos = obtenerDatosReporte($conexion, $idReporte);
        $accionHistorial = 'cambio_estado';
    }

    $nombreUsuario = (string) ($_SESSION['name_usu'] ?? 'Usuario');
    guardarEventoReporte(
        $conexion,
        $idReporte,
        $idUsuario,
        $nombreUsuario,
        $accionHistorial,
        $anteriores,
        $nuevos
    );
    if (!$conexion->commit()) {
        throw new RuntimeException('No se pudo confirmar la transacción del reporte.');
    }
    echo json_encode(['success' => true, 'mensaje' => 'Reporte guardado y agregado al historial.', 'id_reporte' => $idReporte]);
} catch (Throwable $error) {
    $conexion->rollback();
    error_log('Error al guardar reporte de anomalía: ' . $error->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'mensaje' => 'No se pudo guardar el reporte de anomalía.']);
}
