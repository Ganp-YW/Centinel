<?php

final class Dispositivo
{
    public function __construct(
        public int $id_dispositivo,
        public string $name_dispositivo,
        public string $ip_dispositivo,
        public int $status,
        public float $BW_dispositivo,
        public float $latencia_dispositivo,
        public string $fecha,
        public string $sede
    ) {
    }

    public static function listar(mysqli $conexion, ?string $sede = null): array
    {
        $sql = "SELECT d.id_dispositivo, d.name_dispositivo, d.ip_dispositivo, d.status,
                       d.BW_dispositivo, d.latencia_dispositivo, d.fecha,
                       COALESCE(s.name_sede, 'Sin Asignar') AS sede
                FROM dispositivo d
                LEFT JOIN sede_dispositivo sd ON d.id_dispositivo = sd.id_dispositivo
                LEFT JOIN sede s ON sd.id_sede = s.id_sede";
        $filtrarSede = $sede !== null && $sede !== '' && strtolower($sede) !== 'todas';
        if ($filtrarSede) {
            $sql .= " WHERE LOWER(s.name_sede) = LOWER(?)";
        }
        $sql .= " ORDER BY d.id_dispositivo ASC";

        $stmt = $conexion->prepare($sql);
        if (!$stmt) {
            throw new RuntimeException('No se pudo preparar la consulta de dispositivos.');
        }
        if ($filtrarSede) {
            $sedeParametro = $sede;
            $stmt->bind_param('s', $sedeParametro);
        }
        if (!$stmt->execute()) {
            throw new RuntimeException('No se pudo consultar el inventario de dispositivos.');
        }

        $resultado = $stmt->get_result();
        $dispositivos = [];
        while ($fila = $resultado->fetch_assoc()) {
            $dispositivos[] = new self(
                (int) $fila['id_dispositivo'],
                $fila['name_dispositivo'],
                $fila['ip_dispositivo'],
                (int) $fila['status'],
                (float) $fila['BW_dispositivo'],
                (float) $fila['latencia_dispositivo'],
                $fila['fecha'],
                $fila['sede']
            );
        }
        $stmt->close();
        return $dispositivos;
    }

    public function toArray(): array
    {
        return [
            'id_dispositivo' => $this->id_dispositivo,
            'name_dispositivo' => $this->name_dispositivo,
            'ip_dispositivo' => $this->ip_dispositivo,
            'status' => $this->status,
            'BW_dispositivo' => $this->BW_dispositivo,
            'latencia_dispositivo' => $this->latencia_dispositivo,
            'fecha' => $this->fecha,
            'sede' => $this->sede
        ];
    }
}
