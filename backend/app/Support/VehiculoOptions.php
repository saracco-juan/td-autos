<?php

namespace App\Support;

/**
 * Allowed values and limits for the vehicles a dealer loads by hand.
 */
final class VehiculoOptions
{
    public const TRANSMISION = ['manual', 'automatica'];

    public const COMBUSTIBLE = ['nafta', 'diesel', 'gnc', 'hibrido', 'electrico'];

    /** Default currency for the legacy CSV flow until its matching-facts stage. */
    public const MONEDA = 'ARS';

    public const MONEDAS = ['ARS', 'USD'];

    public const POTENCIA_UNIDADES = ['CV', 'HP', 'kW'];

    /** Value of vehiculo.origen for cars loaded by a dealer. */
    public const ORIGEN_CONCESIONARIA = 'concesionaria';

    /** Value of vehiculo.origen for listings read from an external marketplace. */
    public const ORIGEN_EXTERNO = 'externo';

    public const FOTOS_MINIMO = 7;

    public const FOTOS_MAXIMO = 20;

    /** Per photo, in kilobytes (the unit of Laravel's max rule). */
    public const FOTO_MAX_KB = 5120;

    public const FOTO_MIMES = ['jpg', 'jpeg', 'png', 'webp'];
}
