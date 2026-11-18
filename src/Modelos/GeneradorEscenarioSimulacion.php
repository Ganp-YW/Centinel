<?php

final class GeneradorEscenarioSimulacion
{
    public const ESCENARIOS = ['caida', 'latencia', 'congestion', 'recuperacion'];

    public static function generar(
        array $dispositivos,
        string $escenario,
        int $duracionSegundos,
        int $intervaloSegundos,
        int $semilla,
        DateTimeImmutable $fechaHasta
    ): array {
        if (
            !in_array($escenario, self::ESCENARIOS, true)
            || $duracionSegundos < 60
            || $intervaloSegundos < 60
            || $duracionSegundos % $intervaloSegundos !== 0
        ) {
            throw new InvalidArgumentException('La configuración temporal del escenario no es válida.');
        }

        mt_srand($semilla, MT_RAND_MT19937);
        $fechaDesde = $fechaHasta->modify("-{$duracionSegundos} seconds");
        $cantidadPasos = intdiv($duracionSegundos, $intervaloSegundos);
        $mediciones = [];

        foreach ($dispositivos as $dispositivo) {
            for ($paso = 0; $paso <= $cantidadPasos; $paso++) {
                $progreso = $cantidadPasos === 0 ? 1 : $paso / $cantidadPasos;
                $intensidad = max(0.0, 1.0 - (abs($progreso - 0.5) / 0.25));
                $conectividad = (int) $dispositivo['conectividad'];
                $latencia = (float) $dispositivo['latencia'];
                $anchoBanda = (float) $dispositivo['ancho_banda'];

                if ($escenario === 'caida' && $progreso >= 0.3 && $progreso <= 0.7) {
                    $conectividad = 0;
                } elseif ($escenario === 'latencia' && $conectividad === 1) {
                    $latencia *= 1 + (4 * $intensidad);
                    $anchoBanda *= 1 - (0.1 * $intensidad);
                } elseif ($escenario === 'congestion' && $conectividad === 1) {
                    $latencia *= 1 + (3 * $intensidad);
                    $anchoBanda *= 1 - (0.8 * $intensidad);
                } elseif ($escenario === 'recuperacion') {
                    $conectividad = $progreso < 0.25 ? 0 : 1;
                    $recuperacion = max(0.0, min(1.0, ($progreso - 0.25) / 0.75));
                    $severidad = 1 - $recuperacion;
                    $latencia *= 1 + (4 * $severidad);
                    $anchoBanda *= 0.2 + (0.8 * $recuperacion);
                }

                if ($conectividad === 0) {
                    $latencia = 0.0;
                    $anchoBanda = 0.0;
                } else {
                    $variacion = mt_rand(9800, 10200) / 10000;
                    $latencia *= $variacion;
                    $anchoBanda *= $variacion;
                }

                $mediciones[] = [
                    ...$dispositivo,
                    'conectividad' => $conectividad,
                    'latencia' => round($latencia, 1),
                    'ancho_banda' => round($anchoBanda, 1),
                    'fecha_registro' => $fechaDesde
                        ->modify('+' . ($paso * $intervaloSegundos) . ' seconds')
                        ->format('Y-m-d H:i:s'),
                    'indice_paso' => $paso
                ];
            }
        }

        return $mediciones;
    }
}
