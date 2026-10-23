<?php

// Provisional values: replaced with sourced rates in T3.
//
// Every rate is the UPPER end of its range: the calculator is a ceiling, never a promise.

return [
    // Date the rates were last reviewed (shown on the screen as "valores actualizados al ...").
    'updated_at' => '2026-10-23',

    // Every concept rounds UP to a multiple of this amount (ARS).
    'rounding' => 1000,

    // Upper bound of km/month for each diagnostico answer (see App\Support\DiagnosticoOptions).
    'km_per_month' => [
        'menos_500' => 500,
        '500_1500' => 1500,
        '1500_3000' => 3000,
        'mas_3000' => 4500,
        'no_sabe' => 1500,
    ],

    // ARS per liter (nafta, diesel) or per m3 (gnc).
    'fuel_prices' => [
        'nafta' => 1900,
        'diesel' => 2000,
        'gnc' => 700,
    ],

    // Fraction of the vehicle value per year.
    'insurance_annual_rate' => [
        'terceros_completo' => 0.045,
        'todo_riesgo' => 0.08,
    ],

    'transfer' => [
        // DNRPA registration fee, fraction of the vehicle value.
        'dnrpa_rate' => 0.01,
        // Forms, report, plate and certificates (ARS).
        'fixed_costs' => 150000,
        // Provincial stamp tax, fraction of the vehicle value, by normalized province.
        'stamp_rate' => [
            'buenos_aires' => 0.012, 'caba' => 0.01, 'catamarca' => 0.015, 'chaco' => 0.02,
            'chubut' => 0.015, 'cordoba' => 0.015, 'corrientes' => 0.015, 'entre_rios' => 0.015,
            'formosa' => 0.02, 'jujuy' => 0.015, 'la_pampa' => 0.015, 'la_rioja' => 0.015,
            'mendoza' => 0.015, 'misiones' => 0.02, 'neuquen' => 0.015, 'rio_negro' => 0.015,
            'salta' => 0.015, 'san_juan' => 0.015, 'san_luis' => 0.015, 'santa_cruz' => 0.015,
            'santa_fe' => 0.015, 'santiago_del_estero' => 0.015, 'tierra_del_fuego' => 0.015,
            'tucuman' => 0.015,
        ],
    ],

    // Annual vehicle tax, fraction of the vehicle value, by normalized province.
    'patente_annual_rate' => [
        'buenos_aires' => 0.035, 'caba' => 0.035, 'catamarca' => 0.035, 'chaco' => 0.035,
        'chubut' => 0.035, 'cordoba' => 0.035, 'corrientes' => 0.035, 'entre_rios' => 0.035,
        'formosa' => 0.035, 'jujuy' => 0.035, 'la_pampa' => 0.035, 'la_rioja' => 0.035,
        'mendoza' => 0.035, 'misiones' => 0.035, 'neuquen' => 0.035, 'rio_negro' => 0.035,
        'salta' => 0.035, 'san_juan' => 0.035, 'san_luis' => 0.035, 'santa_cruz' => 0.035,
        'santa_fe' => 0.035, 'santiago_del_estero' => 0.035, 'tierra_del_fuego' => 0.035,
        'tucuman' => 0.035,
    ],

    'maintenance' => [
        // ARS per year for a vehicle in the first band of age and km.
        'annual_base' => [
            'nafta' => 900000,
            'diesel' => 1100000,
            'gnc' => 1000000,
            'hibrido' => 800000,
            'electrico' => 600000,
        ],
        // Ordered bands: the first band whose max is >= the value applies; max null is the open band.
        'age_factors' => [
            ['max' => 5, 'factor' => 1.0],
            ['max' => 10, 'factor' => 1.3],
            ['max' => null, 'factor' => 1.7],
        ],
        'km_factors' => [
            ['max' => 50000, 'factor' => 1.0],
            ['max' => 100000, 'factor' => 1.2],
            ['max' => 150000, 'factor' => 1.4],
            ['max' => null, 'factor' => 1.7],
        ],
        'turbo_factor' => 1.15,
        'automatic_factor' => 1.2,
    ],
];
