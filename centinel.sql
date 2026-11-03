-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 22-10-2026 a las 03:15:14
-- Versión del servidor: 10.4.32-MariaDB
-- Versión de PHP: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de datos: `centinel`
--

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `dispositivo`
--

CREATE TABLE `dispositivo` (
  `id_dispositivo` int(11) NOT NULL,
  `name_dispositivo` varchar(255) NOT NULL,
  `ip_dispositivo` varchar(255) NOT NULL,
  `status` tinyint(1) NOT NULL,
  `BW_dispositivo` double NOT NULL,
  `latencia_dispositivo` int(11) NOT NULL,
  `fecha` date NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `sede`
--

CREATE TABLE `sede` (
  `id_sede` int(11) NOT NULL,
  `name_sede` varchar(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `sede_dispositivo`
--

CREATE TABLE `sede_dispositivo` (
  `id_sede` int(11) NOT NULL,
  `id_dispositivo` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `usuario`
--

CREATE TABLE `usuario` (
  `id_usuario` int(11) NOT NULL,
  `name_usu` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `passw` varchar(255) NOT NULL,
  `type` varchar(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `simulacion`
--

CREATE TABLE `simulacion` (
  `id_simulacion` int(11) NOT NULL AUTO_INCREMENT,
  `id_dispositivo` int(11) NOT NULL,
  `conectividad` tinyint(1) NOT NULL DEFAULT 1 COMMENT '1=conectado, 0=desconectado',
  `latencia` float NOT NULL DEFAULT 0 COMMENT 'Latencia en milisegundos',
  `ancho_banda` float NOT NULL DEFAULT 0 COMMENT 'Ancho de banda en Mbps',
  `modo` enum('automatico','manual') NOT NULL DEFAULT 'automatico',
  `fecha_registro` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_simulacion`),
  KEY `idx_dispositivo_fecha` (`id_dispositivo`,`fecha_registro`),
  KEY `idx_fecha_registro` (`fecha_registro`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `usuario`
--

INSERT INTO `usuario` (`id_usuario`, `name_usu`, `email`, `passw`, `type`) VALUES
(1, 'Admin1', 'ejemplogerenciagmail.com', '1234', 'Gerente'),
(2, 'Admin2', 'ejemplotecnico@gmail.com', '1234', 'Tecnico');

--
-- Volcado de datos para la tabla `sede`
--

INSERT INTO `sede` (`id_sede`, `name_sede`) VALUES
(1, 'Miranda'),
(2, 'Aragua'),
(3, 'Táchira');

--
-- Volcado de datos para la tabla `dispositivo`
--

INSERT INTO `dispositivo` (`id_dispositivo`, `name_dispositivo`, `ip_dispositivo`, `status`, `BW_dispositivo`, `latencia_dispositivo`, `fecha`) VALUES
(1, 'Router Principal', '192.168.1.1', 1, 100, 12, '2026-10-22'),
(2, 'Switch Piso 2', '192.168.1.14', 0, 0, 0, '2026-10-22'),
(3, 'Firewall Perimetral', '192.168.1.254', 1, 500, 8, '2026-10-23'),
(4, 'Switch Core Aragua', '192.168.2.1', 1, 1000, 15, '2026-10-24'),
(5, 'Servidor DNS/DHCP', '192.168.2.10', 1, 100, 5, '2026-10-24'),
(6, 'Router Borde Táchira', '192.168.3.1', 1, 200, 24, '2026-10-25'),
(7, 'Access Point Planta 1', '192.168.3.20', 0, 0, 0, '2026-10-25'),
(8, 'Servidor de Respaldos', '192.168.1.50', 1, 300, 11, '2026-10-26');

--
-- Volcado de datos para la tabla `sede_dispositivo`
--

INSERT INTO `sede_dispositivo` (`id_sede`, `id_dispositivo`) VALUES
(1, 1),
(2, 2),
(1, 3),
(2, 4),
(2, 5),
(3, 6),
(3, 7),
(1, 8);

--
-- Volcado de datos para la tabla `simulacion`
-- Datos de ejemplo para probar el monitoreo y los reportes de octubre de 2026.
--

INSERT INTO `simulacion` (`id_dispositivo`, `conectividad`, `latencia`, `ancho_banda`, `modo`, `fecha_registro`) VALUES
(1, 1, 11.5,  98.2, 'automatico', '2026-10-03 08:00:00'),
(1, 1, 12.8, 101.4, 'automatico', '2026-10-10 14:30:00'),
(1, 1, 10.3,  99.7, 'manual',     '2026-10-18 09:15:00'),
(1, 1, 13.1,  97.5, 'automatico', '2026-10-25 16:45:00'),
(2, 1,  8.4,  45.6, 'automatico', '2026-10-02 10:00:00'),
(2, 0,  0.0,   0.0, 'automatico', '2026-10-11 03:20:00'),
(2, 0,  0.0,   0.0, 'manual',     '2026-10-19 11:00:00'),
(2, 1,  9.1,  44.8, 'automatico', '2026-10-27 08:30:00'),
(3, 1,  7.2, 485.3, 'automatico', '2026-10-01 06:00:00'),
(3, 1,  8.5, 502.1, 'automatico', '2026-10-09 12:45:00'),
(3, 1,  6.9, 498.7, 'manual',     '2026-10-17 15:30:00'),
(3, 1,  9.0, 510.0, 'automatico', '2026-10-26 22:00:00'),
(4, 1, 14.2, 980.5, 'automatico', '2026-10-04 07:30:00'),
(4, 1, 16.1, 975.0, 'automatico', '2026-10-12 13:00:00'),
(4, 1, 13.8, 990.2, 'manual',     '2026-10-20 10:20:00'),
(4, 1, 15.5, 985.7, 'automatico', '2026-10-28 17:10:00'),
(5, 1,  4.7,  99.1, 'automatico', '2026-10-03 09:15:00'),
(5, 1,  5.2,  98.5, 'automatico', '2026-10-11 16:40:00'),
(5, 1,  4.1, 100.3, 'manual',     '2026-10-19 08:00:00'),
(5, 1,  5.8,  97.9, 'automatico', '2026-10-27 14:25:00'),
(6, 1, 22.4, 195.8, 'automatico', '2026-10-02 11:30:00'),
(6, 1, 25.7, 198.3, 'automatico', '2026-10-10 18:00:00'),
(6, 0,  0.0,   0.0, 'manual',     '2026-10-16 02:45:00'),
(6, 1, 23.9, 201.5, 'automatico', '2026-10-24 09:50:00'),
(7, 1, 18.3,  52.4, 'automatico', '2026-10-05 08:45:00'),
(7, 0,  0.0,   0.0, 'automatico', '2026-10-13 22:10:00'),
(7, 0,  0.0,   0.0, 'manual',     '2026-10-21 06:30:00'),
(7, 1, 19.7,  50.1, 'automatico', '2026-10-29 12:15:00'),
(8, 1, 10.6, 295.4, 'automatico', '2026-10-01 14:00:00'),
(8, 1, 11.9, 302.8, 'automatico', '2026-10-08 20:30:00'),
(8, 1,  9.8, 298.1, 'manual',     '2026-10-16 10:45:00'),
(8, 1, 12.3, 305.0, 'automatico', '2026-10-25 07:20:00');

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `dispositivo`
--
ALTER TABLE `dispositivo`
  ADD PRIMARY KEY (`id_dispositivo`),
  ADD UNIQUE KEY `name_dispositivo` (`name_dispositivo`);

--
-- Indices de la tabla `sede`
--
ALTER TABLE `sede`
  ADD PRIMARY KEY (`id_sede`);

--
-- Indices de la tabla `sede_dispositivo`
--
ALTER TABLE `sede_dispositivo`
  ADD PRIMARY KEY (`id_sede`,`id_dispositivo`),
  ADD KEY `fk_sd_dispositivo` (`id_dispositivo`);

--
-- Indices de la tabla `usuario`
--
ALTER TABLE `usuario`
  ADD PRIMARY KEY (`id_usuario`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `dispositivo`
--
ALTER TABLE `dispositivo`
  MODIFY `id_dispositivo` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `sede`
--
ALTER TABLE `sede`
  MODIFY `id_sede` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `usuario`
--
ALTER TABLE `usuario`
  MODIFY `id_usuario` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT de la tabla `simulacion`
--
ALTER TABLE `simulacion`
  MODIFY `id_simulacion` int(11) NOT NULL AUTO_INCREMENT;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `sede_dispositivo`
--
ALTER TABLE `sede_dispositivo`
  ADD CONSTRAINT `fk_sd_dispositivo` FOREIGN KEY (`id_dispositivo`) REFERENCES `dispositivo` (`id_dispositivo`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_sd_sede` FOREIGN KEY (`id_sede`) REFERENCES `sede` (`id_sede`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Filtros para la tabla `simulacion`
--
ALTER TABLE `simulacion`
  ADD CONSTRAINT `fk_simulacion_dispositivo` FOREIGN KEY (`id_dispositivo`) REFERENCES `dispositivo` (`id_dispositivo`) ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
