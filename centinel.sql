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
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `sede_dispositivo`
--
ALTER TABLE `sede_dispositivo`
  ADD CONSTRAINT `fk_sd_dispositivo` FOREIGN KEY (`id_dispositivo`) REFERENCES `dispositivo` (`id_dispositivo`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_sd_sede` FOREIGN KEY (`id_sede`) REFERENCES `sede` (`id_sede`) ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
