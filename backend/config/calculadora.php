<?php

// Rates of the ownership cost calculator (HU10 / RF09), reviewed on `updated_at`.
//
// Every rate is the UPPER end of its range: the calculator is a ceiling, never a promise.
// No primary source (DNRPA, ARBA, AGIP, YPF) was reachable on the review date; the values come from
// secondary sources (news, public calculators, dealer price lists), taking the max across them.
// Update the values and `updated_at` together, by commit.

return [
    // Date the rates were last reviewed (shown on the screen as "valores actualizados al ...").
    'updated_at' => '2026-10-24',

    // Month (YYYY-MM) in which the ARS amounts below (transfer.fixed_costs) are stated.
    // insurance, patente and maintenance state their ARS amounts at their own `cpi_base_month`.
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

    // Car insurance, per month, in two coverages.
    //
    // Terceros completo (TC) = max(tc_base[body type], price x value_rate_tc / 12) x zone_factor[province].
    // Todo riesgo (TR)       = max(TC x tr_ratio[body type], price x value_rate_tr / 12).
    // The ratio multiplies the TC already rounded up, so the screen can explain TR from the TC it shows.
    // `price` is the ARS price base of the calculator. An unknown body type takes the highest tc_base and tr_ratio;
    // a province outside zone_factor (or an unknown one) takes `default`.
    //
    // Sources (no source publishes a premium by model + year + zone, only ranges from comparators):
    //  - tc_base and tr_ratio: multicotizadorseguros.com price table, Oct-2026, 2024 units, TOP of each range per body
    //    type (tr_ratio = TR top / TC top of the same table).
    //    https://multicotizadorseguros.com/ar/guias/tabla-de-precios-seguros-autos-argentina
    //  - zone_factor: seguroya.com.ar zone ranges for a mid-size TC (CABA 145k, Córdoba 115k, Rosario 112k, Mendoza 105k),
    //    expressed against AMBA = 1.0. Provinces without a published range use `default`.
    //    https://seguroya.com.ar/seguros-de-autos-precios
    //  - Vehicle age and GNC conversion are NOT modeled: no source quantifies them.
    //
    // Yearly review: tc_base (ARS), zone_factor and tr_ratio, together with `updated_at`.
    'insurance' => [
        // ARS per month at AMBA prices, stated at `cpi_base_month`. The monthly refresh scales them by
        // max(1, CPI latest / CPI of that month).
        'tc_base' => [
            'hatchback' => 103000,
            'sedan' => 114000,
            'rural' => 114000, // "Rural / familiar"
            'suv' => 108000,
            'pickup' => 152000,
            'furgon' => 152000,
        ],
        // Fraction of the vehicle price per year: when it exceeds the body base, the price decides.
        'value_rate_tc' => 0.023,
        'zone_factor' => [
            'caba' => 1.00,
            'buenos_aires' => 1.00,
            'cordoba' => 0.80,
            'santa_fe' => 0.78,
            'mendoza' => 0.73,
            'default' => 0.80,
        ],
        'tr_ratio' => [
            'hatchback' => 1.8,
            'sedan' => 2.1,
            'rural' => 2.1,
            'suv' => 2.0,
            'pickup' => 2.35,
            'furgon' => 2.35,
        ],
        // Fraction of the vehicle price per year: the floor of todo riesgo. 5.3% puts an $80M Hilux
        // at the top of the published todo riesgo range (352k a month).
        'value_rate_tr' => 0.053,
        // Month (YYYY-MM) of the tc_base amounts; independent from the top-level `cpi_base_month`.
        // Until INDEC publishes it, the CPI factor is 1.
        'cpi_base_month' => '2026-10',
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

    // Annual vehicle tax (patente), by normalized province. Three schemes, in this order of precedence:
    //  - `scale`: progressive scale over the ARS price. Each bracket is {up_to, fixed, rate} and the tax is
    //    fixed + rate x (price - previous up_to); the last bracket has up_to null. A price equal to a limit belongs
    //    to the bracket that ends there.
    //  - `bracket_rate`: one rate for the WHOLE price, chosen by the bracket {up_to, rate} the price falls in.
    //  - `flat_rate`: one rate over the price. A province outside the three maps takes the highest flat rate.
    // Monthly patente = annual / 12. The price stands in for the fiscal valuation.
    //
    // Sources:
    //  - Buenos Aires: ARBA 2026 scale, Infobae 2026-02-12.
    //    https://www.infobae.com/economia/2026/02/12/confirmado-a-partir-de-marzo-las-patentes-bonaerenses-comenzaran-a-pagarse-todos-los-meses/
    //  - CABA: the same ARBA scale, as an APPROXIMATION: AGIP's brackets were not found.
    //  - Córdoba: hacecuentas.com 2026 (unofficial calculator).
    //    https://hacecuentas.com/calculadora-patente-auto-cordoba-2026-valuacion-fiscal-cuotas
    //  - Flat rates: top of each scale (servidos.ar 2026-09, Infobae/UADE 2026-05-20).
    //
    // Yearly review: the scales and flat rates, together with `cpi_base_month` and `updated_at`.
    'patente' => [
        // Month (YYYY-MM) of the bracket limits and fixed amounts (ARBA scale: Feb-2026). The monthly refresh scales
        // them by max(1, CPI latest / CPI of that month); the rates are never indexed.
        'cpi_base_month' => '2026-02',
        'scale' => [
            'buenos_aires' => [
                ['up_to' => 14100000, 'fixed' => 0, 'rate' => 0.01],
                ['up_to' => 18700000, 'fixed' => 141000, 'rate' => 0.02],
                ['up_to' => 26100000, 'fixed' => 233000, 'rate' => 0.03],
                ['up_to' => 53900000, 'fixed' => 455000, 'rate' => 0.04],
                ['up_to' => null, 'fixed' => 1567000, 'rate' => 0.045],
            ],
            // Approximation: ARBA's scale until AGIP's brackets are found.
            'caba' => [
                ['up_to' => 14100000, 'fixed' => 0, 'rate' => 0.01],
                ['up_to' => 18700000, 'fixed' => 141000, 'rate' => 0.02],
                ['up_to' => 26100000, 'fixed' => 233000, 'rate' => 0.03],
                ['up_to' => 53900000, 'fixed' => 455000, 'rate' => 0.04],
                ['up_to' => null, 'fixed' => 1567000, 'rate' => 0.045],
            ],
        ],
        'bracket_rate' => [
            'cordoba' => [
                ['up_to' => 5000000, 'rate' => 0.015],
                ['up_to' => 10000000, 'rate' => 0.02],
                ['up_to' => 20000000, 'rate' => 0.025],
                ['up_to' => 50000000, 'rate' => 0.03],
                ['up_to' => 100000000, 'rate' => 0.0375],
                ['up_to' => null, 'rate' => 0.045],
            ],
        ],
        'flat_rate' => [
            'catamarca' => 0.016, 'chaco' => 0.022,
            'chubut' => 0.027, 'corrientes' => 0.02, 'entre_rios' => 0.0333,
            'formosa' => 0.012, 'jujuy' => 0.015, 'la_pampa' => 0.02, 'la_rioja' => 0.015,
            'mendoza' => 0.03, 'misiones' => 0.018, 'neuquen' => 0.02, 'rio_negro' => 0.035,
            'salta' => 0.025, 'san_juan' => 0.015, 'san_luis' => 0.035, 'santa_cruz' => 0.028,
            'santa_fe' => 0.023, 'santiago_del_estero' => 0.018, 'tierra_del_fuego' => 0.03,
            'tucuman' => 0.02,
        ],
    ],

    // Maintenance per month = km per month x per_km[body type] x age factor x fuel factor, rounded up.
    // The km per month is the one fuel uses (diagnostico, default or the user's input). An unknown body type takes
    // the highest per_km.
    //
    // Sources: first official services at a 10,000 km interval.
    //  - La Nación 2025-10, official service ranking:
    //    https://www.lanacion.com.ar/autos/servicie-oficial-del-auto-el-ranking-de-precios-de-las-automotrices-nid01102025/
    //  - iProfesional 2026-04:
    //    https://www.iprofesional.com/autos/452731-service-auto-cuanto-cuesta-concesionarias-y-que-precio-en-taller-independiente
    //
    // Yearly review: per_km and the factors, together with `cpi_base_month` and `updated_at`.
    'maintenance' => [
        // ARS per km at `cpi_base_month`. The monthly refresh scales them by max(1, CPI latest / CPI of that month).
        'per_km' => [
            'hatchback' => 20,
            'sedan' => 38,
            'rural' => 34,
            'suv' => 34,
            'pickup' => 40,
            'furgon' => 34,
        ],
        // Ordered bands: the first band whose max is >= the age in years applies; max null is the open band.
        // The factors are judgment calls, without a source.
        'age_factors' => [
            ['max' => 5, 'factor' => 1.0],
            ['max' => 10, 'factor' => 1.2],
            ['max' => 15, 'factor' => 1.5],
            ['max' => null, 'factor' => 1.8],
        ],
        // Gnc and electrico are estimates, without a source. An unknown fuel takes the highest factor.
        'fuel_factor' => [
            'nafta' => 1.0,
            'diesel' => 1.0,
            'hibrido' => 1.0,
            'gnc' => 1.15,
            'electrico' => 0.5,
        ],
        // Month (YYYY-MM) of the per_km amounts; independent from the top-level `cpi_base_month`.
        'cpi_base_month' => '2026-04',
    ],
];
