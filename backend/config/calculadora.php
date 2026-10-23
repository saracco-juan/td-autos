<?php

// Rates of the ownership cost calculator (HU10 / RF09), reviewed on `updated_at`.
//
// Every rate is the UPPER end of its range: the calculator is a ceiling, never a promise.
// No primary source (DNRPA, ARBA, AGIP, YPF) was reachable on the review date; the values come from
// secondary sources (news, public calculators, dealer price lists), taking the max across them.
// Update the values and `updated_at` together, by commit.

return [
    // Date the rates were last reviewed (shown on the screen as "valores actualizados al ...").
    'updated_at' => '2026-10-23',

    // Month (YYYY-MM) in which the ARS amounts below (maintenance.annual_base, transfer.fixed_costs) are stated.
    // The monthly refresh (calculadora:refresh) scales them by max(1, CPI latest / CPI of this month).
    // Move it forward together with those amounts when they are reviewed by hand.
    'cpi_base_month' => '2026-08',

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

    // ARS per liter (nafta, diesel) or per m3 (gnc). Fallback: the monthly refresh overrides them with the
    // 90th percentile per province from the Secretaría de Energía (national figure for provinces without rows).
    // Nafta súper: YPF Mendoza 2026-09-28 (above CABA). Diesel: hedge over YPF Mendoza 2,295.
    // GNC: estimate over the 1,050 reported in Mar del Plata in 2026-05.
    'fuel_prices' => [
        'nafta' => 2125,
        'diesel' => 2450,
        'gnc' => 1100,
    ],

    // Fraction of the vehicle value per year: top of the mid-range premiums published by
    // seguroya.com.ar (2026-06) over a used car of about ARS 20M.
    'insurance_annual_rate' => [
        'terceros_completo' => 0.07,
        'todo_riesgo' => 0.14,
    ],

    'transfer' => [
        // DNRPA registration fee, fraction of the vehicle value: 1% in 2026 sources, 1.5% kept as a hedge.
        'dnrpa_rate' => 0.015,
        // Minimum fee 33,600 + police check 25,000 + forms and domain report ~20,000, rounded up; no gestor (ARS).
        'fixed_costs' => 80000,
        // Provincial stamp tax on a used car transfer, fraction of the vehicle value, by normalized province.
        'stamp_rate' => [
            'buenos_aires' => 0.03, 'caba' => 0.03, 'catamarca' => 0.015, 'chaco' => 0.015,
            'chubut' => 0.02, 'cordoba' => 0.03, 'corrientes' => 0.015, 'entre_rios' => 0.025,
            'formosa' => 0.015, 'jujuy' => 0.02, 'la_pampa' => 0.015, 'la_rioja' => 0.015,
            'mendoza' => 0.03, 'misiones' => 0.03, 'neuquen' => 0.02, 'rio_negro' => 0.02,
            'salta' => 0.02, 'san_juan' => 0.015, 'san_luis' => 0.015, 'santa_cruz' => 0.03,
            'santa_fe' => 0.028, 'santiago_del_estero' => 0.015, 'tierra_del_fuego' => 0.02,
            'tucuman' => 0.02,
        ],
    ],

    // Annual vehicle tax, fraction of the vehicle value, by normalized province: top of each scale
    // (servidos.ar 2026-09, Infobae/UADE 2026-05-20).
    'patente_annual_rate' => [
        'buenos_aires' => 0.045, 'caba' => 0.04, 'catamarca' => 0.016, 'chaco' => 0.022,
        'chubut' => 0.027, 'cordoba' => 0.032, 'corrientes' => 0.02, 'entre_rios' => 0.0333,
        'formosa' => 0.012, 'jujuy' => 0.015, 'la_pampa' => 0.02, 'la_rioja' => 0.015,
        'mendoza' => 0.03, 'misiones' => 0.018, 'neuquen' => 0.02, 'rio_negro' => 0.035,
        'salta' => 0.025, 'san_juan' => 0.015, 'san_luis' => 0.035, 'santa_cruz' => 0.028,
        'santa_fe' => 0.023, 'santiago_del_estero' => 0.018, 'tierra_del_fuego' => 0.03,
        'tucuman' => 0.02,
    ],

    'maintenance' => [
        // ARS per year for a vehicle in the first band of age and km. Nafta and diesel: two official
        // dealer services (Toyota Yacopini list, 2026-08). Gnc, hibrido and electrico are estimates.
        'annual_base' => [
            'nafta' => 1000000,
            'diesel' => 1300000,
            'gnc' => 1150000,
            'hibrido' => 900000,
            'electrico' => 450000,
        ],
        // Ordered bands: the first band whose max is >= the value applies; max null is the open band.
        // The factors are judgment calls, without a source.
        'age_factors' => [
            ['max' => 5, 'factor' => 1.0],
            ['max' => 10, 'factor' => 1.2],
            ['max' => 15, 'factor' => 1.5],
            ['max' => null, 'factor' => 1.8],
        ],
        'km_factors' => [
            ['max' => 60000, 'factor' => 1.0],
            ['max' => 120000, 'factor' => 1.2],
            ['max' => 200000, 'factor' => 1.5],
            ['max' => null, 'factor' => 1.9],
        ],
        'turbo_factor' => 1.15,
        'automatic_factor' => 1.2,
    ],
];
