<?php

final class Simulacion
{
    public function __construct(
        public int $id_dispositivo,
        public int $conectividad,
        public float $latencia,
        public float $ancho_banda,
        public string $modo,
        public ?string $name_dispositivo = null,
        public ?string $ip_dispositivo = null,
        public ?string $sede = null,
        public ?string $fecha_registro = null,
        public ?int $id_simulacion = null
    ) {
    }

    public static function ultimasPorDispositivo(mysqli $conexion, ?string $sede = null): array
    {
        $sql = "SELECT s.id_simulacion, s.id_dispositivo, d.name_dispositivo, d.ip_dispositivo,
                       COALESCE(se.name_sede, 'Sin Asignar') AS sede,
                       s.conectividad, s.latencia, s.ancho_banda, s.modo, s.fecha_registro
                FROM simulacion s
                INNER JOIN dispositivo d ON s.id_dispositivo = d.id_dispositivo
                LEFT JOIN sede_dispositivo sd ON d.id_dispositivo = sd.id_dispositivo
                LEFT JOIN sede se ON sd.id_sede = se.id_sede
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM simulacion mas_reciente
                    WHERE mas_reciente.id_dispositivo = s.id_dispositivo
                      AND (
                          mas_reciente.fecha_registro > s.fecha_registro
                          OR (
                              mas_reciente.fecha_registro = s.fecha_registro
                              AND mas_reciente.id_simulacion > s.id_simulacion
                          )
                      )
                )";
        $filtrarSede = $sede !== null && $sede !== '' && strtolower($sede) !== 'todas';
        if ($filtrarSede) {
            $sql .= " AND LOWER(se.name_sede) = LOWER(?)";
        }
        $sql .= " ORDER BY s.id_dispositivo ASC";

        $stmt = $conexion->prepare($sql);
        if (!$stmt) {
            throw new RuntimeException('No se pudo preparar la consulta de últimas simulaciones.');
        }
        if ($filtrarSede) {
            $sedeParametro = $sede;
            $stmt->bind_param('s', $sedeParametro);
        }
        if (!$stmt->execute()) {
            throw new RuntimeException('No se pudo consultar el historial de simulaciones.');
        }

        $resultado = $stmt->get_result();
        $simulaciones = [];
        while ($fila = $resultado->fetch_assoc()) {
            $simulaciones[] = new self(
                (int) $fila['id_dispositivo'],
                (int) $fila['conectividad'],
                (float) $fila['latencia'],
                (float) $fila['ancho_banda'],
                $fila['modo'],
                $fila['name_dispositivo'],
                $fila['ip_dispositivo'],
                $fila['sede'],
                $fila['fecha_registro'],
                (int) $fila['id_simulacion']
            );
        }
        $stmt->close();
        return $simulaciones;
    }

    public static function listarHistorial(mysqli $conexion, int $limite, int $offset, ?string $sede = null): array
    {
        $sql = "SELECT s.id_simulacion, s.id_dispositivo, d.name_dispositivo, d.ip_dispositivo,
                       COALESCE(se.name_sede, 'Sin Asignar') AS sede,
                       s.conectividad, s.latencia, s.ancho_banda, s.modo, s.fecha_registro
                FROM simulacion s
                INNER JOIN dispositivo d ON s.id_dispositivo = d.id_dispositivo
                LEFT JOIN sede_dispositivo sd ON d.id_dispositivo = sd.id_dispositivo
                LEFT JOIN sede se ON sd.id_sede = se.id_sede";
        $filtrarSede = $sede !== null && $sede !== '' && strtolower($sede) !== 'todas';
        if ($filtrarSede) {
            $sql .= " WHERE LOWER(se.name_sede) = LOWER(?)";
        }
        $sql .= " ORDER BY s.fecha_registro DESC, s.id_simulacion DESC LIMIT ? OFFSET ?";
        $stmt = $conexion->prepare($sql);
        if (!$stmt) {
            throw new RuntimeException('No se pudo preparar la consulta del historial de simulaciones.');
        }
        if ($filtrarSede) {
            $sedeParametro = $sede;
            $stmt->bind_param('sii', $sedeParametro, $limite, $offset);
        } else {
            $stmt->bind_param('ii', $limite, $offset);
        }
        if (!$stmt->execute()) {
            throw new RuntimeException('No se pudo consultar el historial de simulaciones.');
        }

        $resultado = $stmt->get_result();
        $simulaciones = [];
        while ($fila = $resultado->fetch_assoc()) {
            $simulaciones[] = new self(
                (int) $fila['id_dispositivo'],
                (int) $fila['conectividad'],
                (float) $fila['latencia'],
                (float) $fila['ancho_banda'],
                $fila['modo'],
                $fila['name_dispositivo'],
                $fila['ip_dispositivo'],
                $fila['sede'],
                $fila['fecha_registro'],
                (int) $fila['id_simulacion']
            );
        }
        $stmt->close();
        return $simulaciones;
    }

    public static function contarHistorial(mysqli $conexion, ?string $sede = null): int
    {
        $sql = "SELECT COUNT(*)
                FROM simulacion s
                INNER JOIN dispositivo d ON s.id_dispositivo = d.id_dispositivo
                LEFT JOIN sede_dispositivo sd ON d.id_dispositivo = sd.id_dispositivo
                LEFT JOIN sede se ON sd.id_sede = se.id_sede";
        $filtrarSede = $sede !== null && $sede !== '' && strtolower($sede) !== 'todas';
        if ($filtrarSede) {
            $sql .= " WHERE LOWER(se.name_sede) = LOWER(?)";
        }

        $stmt = $conexion->prepare($sql);
        if (!$stmt) {
            throw new RuntimeException('No se pudo preparar el conteo del historial de simulaciones.');
        }
        if ($filtrarSede) {
            $sedeParametro = $sede;
            $stmt->bind_param('s', $sedeParametro);
        }
        if (!$stmt->execute()) {
            throw new RuntimeException('No se pudo contar el historial de simulaciones.');
        }
        $stmt->bind_result($total);
        $stmt->fetch();
        $stmt->close();
        return (int) $total;
    }

    public function guardar(mysqli $conexion): void
    {
        $sql = "INSERT INTO simulacion
                    (id_dispositivo, conectividad, latencia, ancho_banda, modo, fecha_registro)
                VALUES (?, ?, ?, ?, ?, NOW())";
        $stmt = $conexion->prepare($sql);
        if (!$stmt) {
            throw new RuntimeException('No se pudo preparar el registro de la simulación.');
        }
        $idDispositivo = $this->id_dispositivo;
        $conectividad = $this->conectividad;
        $latencia = $this->latencia;
        $anchoBanda = $this->ancho_banda;
        $modo = $this->modo;
        $stmt->bind_param('iidds', $idDispositivo, $conectividad, $latencia, $anchoBanda, $modo);
        if (!$stmt->execute()) {
            $stmt->close();
            throw new RuntimeException('No se pudo guardar una medición de la simulación.');
        }
        $stmt->close();
    }

    public function toArray(): array
    {
        return [
            'id_simulacion' => $this->id_simulacion,
            'id_dispositivo' => $this->id_dispositivo,
            'name_dispositivo' => $this->name_dispositivo,
            'ip_dispositivo' => $this->ip_dispositivo,
            'sede' => $this->sede,
            'conectividad' => $this->conectividad,
            'latencia' => $this->latencia,
            'ancho_banda' => $this->ancho_banda,
            'modo' => $this->modo,
            'fecha_registro' => $this->fecha_registro
        ];
    }
}
