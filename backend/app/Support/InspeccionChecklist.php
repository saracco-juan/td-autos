<?php

namespace App\Support;

/**
 * Single source of the vehicle inspection checklist: steps, hints and items.
 * The API returns it as is, so no client keeps its own copy. Item codes are stored in
 * item_inspeccion_completado.item_codigo and must stay stable once released.
 */
final class InspeccionChecklist
{
    /**
     * @return list<array{numero: int, titulo: string, ayuda: string|null, items: list<array{codigo: string, texto: string, critico: bool}>}>
     */
    public static function steps(): array
    {
        return [
            [
                'numero' => 1,
                'titulo' => 'Papeles del auto',
                'ayuda' => 'Pedile al vendedor la cédula y el título del auto.',
                'items' => [
                    self::item('papeles_titular', 'El vendedor es el titular o tiene autorización para vender', true),
                    self::item('papeles_chasis_motor', 'Los números de chasis y motor coinciden con la cédula', true),
                    self::item('papeles_vtv', 'VTV vigente'),
                    self::item('papeles_services', 'Services con comprobantes'),
                ],
            ],
            [
                'numero' => 2,
                'titulo' => 'Exterior y carrocería',
                'ayuda' => 'Mirá el auto a la luz del día, en un piso parejo.',
                'items' => [
                    self::item('exterior_pintura', 'Pintura pareja, sin diferencias de tono entre paneles', true),
                    self::item('exterior_oxido', 'Sin óxido en zócalos, pasarruedas y piso', true),
                    self::item('exterior_alineacion', 'Puertas, capot y baúl alineados'),
                    self::item('exterior_vidrios', 'Vidrios sin rajaduras'),
                    self::item('exterior_luces', 'Luces y ópticas funcionando'),
                    self::item('exterior_neumaticos', 'Neumáticos con desgaste parejo'),
                ],
            ],
            [
                'numero' => 3,
                'titulo' => 'Motor y mecánica',
                'ayuda' => 'Con el motor frío, fijate si hay manchas debajo del auto.',
                'items' => [
                    self::item('motor_perdidas', 'Sin pérdidas de aceite o líquidos', true),
                    self::item('motor_aceite', 'Aceite en nivel y sin aspecto lechoso', true),
                    self::item('motor_escape', 'Escape sin humo azul o blanco', true),
                    self::item('motor_refrigerante', 'Líquido refrigerante en nivel y limpio'),
                    self::item('motor_correas', 'Correas y mangueras sin grietas'),
                    self::item('motor_arranque', 'Arranca en frío al primer intento'),
                ],
            ],
            [
                'numero' => 4,
                'titulo' => 'Interior y electrónica',
                'ayuda' => null,
                'items' => [
                    self::item('interior_testigos', 'Los testigos del tablero se apagan al arrancar', true),
                    self::item('interior_kilometraje', 'Kilometraje coherente con el desgaste de volante, pedales y butacas'),
                    self::item('interior_cinturones', 'Cinturones en buen estado'),
                    self::item('interior_climatizacion', 'Aire acondicionado y calefacción funcionan'),
                    self::item('interior_levantavidrios', 'Levantavidrios y cierre funcionan'),
                    self::item('interior_humedad', 'Sin humedad ni olor a moho'),
                ],
            ],
            [
                'numero' => 5,
                'titulo' => 'Prueba de manejo',
                'ayuda' => null,
                'items' => [
                    self::item('manejo_frenos', 'Frena parejo, sin tirones ni vibraciones', true),
                    self::item('manejo_direccion', 'Dirección centrada, no tira hacia un lado', true),
                    self::item('manejo_caja', 'Caja de cambios sin trabas ni ruidos'),
                    self::item('manejo_embrague', 'El embrague no patina'),
                    self::item('manejo_suspension', 'Suspensión sin golpes en pozos'),
                    self::item('manejo_ruidos', 'Motor sin ruidos extraños al acelerar'),
                ],
            ],
        ];
    }

    /**
     * @return list<string>
     */
    public static function codes(): array
    {
        return array_column(self::items(), 'codigo');
    }

    /**
     * @return list<string>
     */
    public static function criticalCodes(): array
    {
        return array_column(array_filter(self::items(), fn (array $item) => $item['critico']), 'codigo');
    }

    public static function exists(string $code): bool
    {
        return in_array($code, self::codes(), true);
    }

    /**
     * @return list<array{codigo: string, texto: string, critico: bool}>
     */
    private static function items(): array
    {
        return array_merge(...array_column(self::steps(), 'items'));
    }

    /**
     * @return array{codigo: string, texto: string, critico: bool}
     */
    private static function item(string $codigo, string $texto, bool $critico = false): array
    {
        return ['codigo' => $codigo, 'texto' => $texto, 'critico' => $critico];
    }
}
