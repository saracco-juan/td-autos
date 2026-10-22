<?php

namespace App\Support;

/**
 * Single source of the vehicle transfer checklist: stages, hints and items.
 * The API returns it as is, so no client keeps its own copy. Item codes are stored in
 * etapa_transferencia_completada.etapa_codigo and must stay stable once released.
 */
final class TransferenciaChecklist
{
    /**
     * @return list<array{numero: int, titulo: string, ayuda: string|null, items: list<array{codigo: string, texto: string, obligatorio: bool}>}>
     */
    public static function stages(): array
    {
        return [
            [
                'numero' => 1,
                'titulo' => 'Antes de señar',
                'ayuda' => 'Revisá esto antes de entregar dinero.',
                'items' => [
                    self::item('antes_informe_dominio', 'Pedí el informe de dominio (titular, prendas, embargos, inhibiciones)'),
                    self::item('antes_titular', 'El vendedor es el titular que figura en el informe'),
                    self::item('antes_deudas', 'Consultá deudas de patentes e infracciones'),
                ],
            ],
            [
                'numero' => 2,
                'titulo' => 'Documentación',
                'ayuda' => 'Juntá estos papeles antes de ir al registro.',
                'items' => [
                    self::item('documentacion_dni', 'DNI del comprador y del vendedor', true),
                    self::item('documentacion_titulo', 'Título del automotor o constancia de asignación de título', true),
                    self::item('documentacion_cedula', 'Cédula del vehículo', true),
                    self::item('documentacion_cuit_cuil', 'CUIT o CUIL del comprador', true),
                    self::item('documentacion_conyuge', 'Si el vendedor está casado, documento y firma del cónyuge', true),
                ],
            ],
            [
                'numero' => 3,
                'titulo' => 'Trámite en el registro',
                'ayuda' => null,
                'items' => [
                    self::item('tramite_verificacion_fisica', 'Verificación física del vehículo (inscriptos desde 2001)', true),
                    self::item('tramite_formulario_08', 'Precarga del formulario 08 digital', true),
                    self::item('tramite_turno', 'Turno en el registro automotor'),
                    self::item('tramite_firma_aranceles', 'Firma de ambas partes y pago de aranceles', true),
                ],
            ],
            [
                'numero' => 4,
                'titulo' => 'Después de transferir',
                'ayuda' => null,
                'items' => [
                    self::item('despues_titulo_cedula', 'Retirá el título y la cédula a tu nombre'),
                    self::item('despues_seguro', 'Contratá el seguro a tu nombre'),
                    self::item('despues_patentes', 'Verificá el alta en patentes de tu provincia'),
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
    public static function mandatoryCodes(): array
    {
        return array_column(array_filter(self::items(), fn (array $item) => $item['obligatorio']), 'codigo');
    }

    public static function exists(string $code): bool
    {
        return in_array($code, self::codes(), true);
    }

    /**
     * @return list<array{codigo: string, texto: string, obligatorio: bool}>
     */
    private static function items(): array
    {
        return array_merge(...array_column(self::stages(), 'items'));
    }

    /**
     * @return array{codigo: string, texto: string, obligatorio: bool}
     */
    private static function item(string $codigo, string $texto, bool $obligatorio = false): array
    {
        return ['codigo' => $codigo, 'texto' => $texto, 'obligatorio' => $obligatorio];
    }
}
