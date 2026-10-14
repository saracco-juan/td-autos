<?php

namespace App\Support;

/**
 * Allowed values and limits for the vehicles a dealer loads by hand.
 */
final class VehiculoOptions
{
    public const TRANSMISION = ['manual', 'automatica'];

    public const COMBUSTIBLE = ['nafta', 'diesel', 'gnc', 'hibrido', 'electrico'];

    /** The portal lists prices in pesos only. */
    public const MONEDA = 'ARS';

    /** Value of vehiculo.origen for cars loaded by a dealer. */
    public const ORIGEN_CONCESIONARIA = 'concesionaria';

    public const FOTOS_MINIMO = 7;

    public const FOTOS_MAXIMO = 20;

    /** Per photo, in kilobytes (the unit of Laravel's max rule). */
    public const FOTO_MAX_KB = 5120;

    public const FOTO_MIMES = ['jpg', 'jpeg', 'png', 'webp'];
}
