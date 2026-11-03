<?php

final class Reporte
{
    public function __construct(
        public string $etiqueta,
        public float $disponibilidad,
        public float $latencia_promedio,
        public float $consumo_total
    ) {
    }

    public static function obtenerPorMes(
        mysqli $conexion,
        string $tipo,
        ?string $sede,
        string $mes
    ): array {
        $desde = $mes . '-01 00:00:00';
        $hasta = date('Y-m-t 23:59:59', strtotime($desde));

        if ($tipo === 'global') {
            $sql = "SELECT COALESCE(se.name_sede, 'Sin Asignar') AS etiqueta,
                           ROUND((SUM(CASE WHEN s.conectividad = 1 THEN 1 ELSE 0 END) / COUNT(*)) * 100, 1) AS disponibilidad,
                           ROUND(AVG(s.latencia), 1) AS latencia_promedio,
                           ROUND(SUM(s.ancho_banda), 1) AS consumo_total
                    FROM simulacion s
                    INNER JOIN dispositivo d ON s.id_dispositivo = d.id_dispositivo
                    LEFT JOIN sede_dispositivo sd ON d.id_dispositivo = sd.id_dispositivo
                    LEFT JOIN sede se ON sd.id_sede = se.id_sede
                    WHERE s.fecha_registro BETWEEN ? AND ?
                    GROUP BY se.name_sede
                    ORDER BY se.name_sede ASC";
            $stmt = $conexion->prepare($sql);
            if (!$stmt) {
                throw new RuntimeException('No se pudo preparar el reporte global.');
            }
            $stmt->bind_param('ss', $desde, $hasta);
        } else {
            $sql = "SELECT d.name_dispositivo AS etiqueta,
                           ROUND((SUM(CASE WHEN s.conectividad = 1 THEN 1 ELSE 0 END) / COUNT(*)) * 100, 1) AS disponibilidad,
                           ROUND(AVG(s.latencia), 1) AS latencia_promedio,
                           ROUND(SUM(s.ancho_banda), 1) AS consumo_total
                    FROM simulacion s
                    INNER JOIN dispositivo d ON s.id_dispositivo = d.id_dispositivo
                    LEFT JOIN sede_dispositivo sd ON d.id_dispositivo = sd.id_dispositivo
                    LEFT JOIN sede se ON sd.id_sede = se.id_sede
                    WHERE s.fecha_registro BETWEEN ? AND ?";
            $filtrarSede = $sede !== null && $sede !== '' && strtolower($sede) !== 'todas';
            if ($filtrarSede) {
                $sql .= " AND LOWER(se.name_sede) = LOWER(?)";
            }
            $sql .= " GROUP BY d.id_dispositivo, d.name_dispositivo
                      ORDER BY d.name_dispositivo ASC";
            $stmt = $conexion->prepare($sql);
            if (!$stmt) {
                throw new RuntimeException('No se pudo preparar el reporte por sede.');
            }
            if ($filtrarSede) {
                $sedeParametro = $sede;
                $stmt->bind_param('sss', $desde, $hasta, $sedeParametro);
            } else {
                $stmt->bind_param('ss', $desde, $hasta);
            }
        }

        if (!$stmt->execute()) {
            $stmt->close();
            throw new RuntimeException('No se pudo consultar el reporte mensual.');
        }
        $resultado = $stmt->get_result();
        $reportes = [];
        while ($fila = $resultado->fetch_assoc()) {
            $reportes[] = new self(
                $fila['etiqueta'],
                (float) $fila['disponibilidad'],
                (float) $fila['latencia_promedio'],
                (float) $fila['consumo_total']
            );
        }
        $stmt->close();
        return $reportes;
    }

    public function toArray(): array
    {
        return [
            'etiqueta' => $this->etiqueta,
            'disponibilidad' => $this->disponibilidad,
            'latencia_promedio' => $this->latencia_promedio,
            'consumo_total' => $this->consumo_total
        ];
    }
}
