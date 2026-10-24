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
    // insurance, patente and each service brand (and the service fallback) state their ARS amounts at their own `cpi_base_month`.
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

    // Service per year = services per year x price per service x fuel factor, rounded up. An occasional cost: it never
    // enters the monthly total, only the yearly one.
    //
    // services per year = ceil(max(km per year / interval_km, 12 / interval_months)); the km per month is the one fuel uses
    // (diagnostico, default or the user's input).
    //
    // Price per service (ARS), the average over one service cycle, looked up in this order:
    //  1. brand + model: `models`, matched as whole words inside the vehicle's `modelo` (the longest key wins, so
    //     "corolla cross" is not "corolla" and "gol" matches "Gol Trend" but not "Golf");
    //  2. brand + body type: the brand's `body` map;
    //  3. `fallback.body`: reference values by body type, for any other brand, missing model or missing body type.
    //     An unknown body type takes the highest reference value.
    // A brand is matched on `vehiculo.marca` by its key or one of its `aliases`, ignoring case and accents.
    // `model_overrides` replaces the brand's interval for one model. Each brand carries the `cpi_base_month` of its
    // prices; the monthly refresh scales them by max(1, CPI latest / CPI of that month).
    //
    // BMW has no Argentine price or interval published, so it uses the fallback. Fuel factors (GNC, electric) are
    // estimates without a source; an unknown fuel takes the highest factor. The service price does not depend on age.
    //
    // Yearly review: the prices, the intervals and the factors, together with each `cpi_base_month` and `updated_at`.
    'service' => [
        'fuel_factor' => [
            'nafta' => 1.0,
            'diesel' => 1.0,
            'hibrido' => 1.0,
            'gnc' => 1.15,
            'electrico' => 0.5,
        ],
        'brands' => [
            // Official dealer price list, Aug-2026: https://toyotayacopini.com/servicio-de-posventa/
            // The 12-month interval is NOT confirmed.
            'toyota' => [
                'label' => 'Toyota',
                'aliases' => [],
                'interval_km' => 10000,
                'interval_months' => 12,
                'cpi_base_month' => '2026-08',
                'models' => [
                    'etios' => 315000,
                    'yaris' => 361000,
                    'corolla' => 486000,
                    'corolla cross' => 486000,
                    'hilux' => 593000,
                    'sw4' => 612000,
                ],
                'body' => [
                    'hatchback' => 361000,
                    'sedan' => 486000,
                    'suv' => 486000,
                    'rural' => 486000,
                    'pickup' => 593000,
                    'furgon' => 593000,
                ],
            ],
            // Dealer price list (undated, so its month is assumed): https://vwmataderos.com.ar/institucional/postventa/precios-de-servicio.htm
            'volkswagen' => [
                'label' => 'Volkswagen',
                'aliases' => ['vw'],
                'interval_km' => 15000,
                'interval_months' => 12,
                'cpi_base_month' => '2025-12',
                'models' => [
                    'gol' => 326000,
                    'polo' => 383000,
                    'virtus' => 383000,
                    't cross' => 383000,
                    'nivus' => 383000,
                    'taos' => 456000,
                    'golf' => 456000,
                    'amarok' => 650000,
                ],
                'model_overrides' => [
                    'amarok' => ['interval_km' => 10000],
                ],
                'body' => [
                    'hatchback' => 383000,
                    'sedan' => 383000,
                    'suv' => 456000,
                    'rural' => 456000,
                    'pickup' => 650000,
                    'furgon' => 650000,
                ],
            ],
            // Infobae 2025-09-17 and La Nación 2025-10. Pickup and furgón are not set: they use the fallback.
            // https://www.lanacion.com.ar/autos/servicie-oficial-del-auto-el-ranking-de-precios-de-las-automotrices-nid01102025/
            'fiat' => [
                'label' => 'Fiat',
                'aliases' => [],
                'interval_km' => 10000,
                'interval_months' => 12,
                'cpi_base_month' => '2025-09',
                'models' => [
                    'cronos' => 378000,
                ],
                'body' => [
                    'hatchback' => 271000, // 2-service pack / 2
                    'sedan' => 378000,
                    'suv' => 378000,
                    'rural' => 378000,
                ],
            ],
            // La Nación 2025-10 and Infobae 2025-09-17. The other bodies are not set: they use the fallback.
            'peugeot' => [
                'label' => 'Peugeot',
                'aliases' => [],
                'interval_km' => 10000,
                'interval_months' => 12,
                'cpi_base_month' => '2025-09',
                'models' => [
                    '208' => 401000,
                ],
                'body' => [
                    'hatchback' => 401000,
                ],
            ],
        ],
        // Reference values by body type: La Nación 2025-10 official service ranking (first services at 10,000 km).
        // https://www.lanacion.com.ar/autos/servicie-oficial-del-auto-el-ranking-de-precios-de-las-automotrices-nid01102025/
        'fallback' => [
            'interval_km' => 10000,
            'interval_months' => 12,
            'cpi_base_month' => '2025-09',
            'body' => [
                'hatchback' => 200000,
                'sedan' => 380000,
                'suv' => 340000,
                'rural' => 340000,
                'furgon' => 340000,
                'pickup' => 400000,
            ],
        ],
    ],

    // Yearly review of the hand-reviewed values (D21). Data only: `calculadora:review` and the January 1 job read it to
    // list the groups whose `reviewed_at` is older than `max_age_months` and to check that each source still answers.
    // It never changes a rate. After reviewing a group, move its `reviewed_at` to the review date (see docs/development.md).
    // Groups without `sources` have no public source; they are judgment or sourced only from the notes above.
    'review' => [
        'max_age_months' => 12,
        // The monthly snapshot (calculadora:refresh) is reported late when the latest valid one is older than this.
        'snapshot_max_age_days' => 40,
        'groups' => [
            'patente_scale' => [
                'label' => 'Escalas de patente (Buenos Aires y CABA)',
                'config_path' => 'patente.scale',
                'reviewed_at' => '2026-10-24',
                'sources' => [
                    'https://www.infobae.com/economia/2026/02/12/confirmado-a-partir-de-marzo-las-patentes-bonaerenses-comenzaran-a-pagarse-todos-los-meses/',
                ],
            ],
            'patente_cordoba' => [
                'label' => 'Tramos de patente de Córdoba',
                'config_path' => 'patente.bracket_rate.cordoba',
                'reviewed_at' => '2026-10-24',
                'sources' => [
                    'https://hacecuentas.com/calculadora-patente-auto-cordoba-2026-valuacion-fiscal-cuotas',
                ],
            ],
            'patente_flat' => [
                'label' => 'Alícuotas de patente (otras provincias)',
                'config_path' => 'patente.flat_rate',
                'reviewed_at' => '2026-10-24',
                'sources' => [],
            ],
            'stamp_duty' => [
                'label' => 'Sellado de transferencia por provincia',
                'config_path' => 'transfer.stamp_rate',
                'reviewed_at' => '2026-10-23',
                'sources' => [],
            ],
            'dnrpa_transfer' => [
                'label' => 'Arancel DNRPA y costos fijos de transferencia',
                'config_path' => 'transfer.dnrpa_rate',
                'reviewed_at' => '2026-10-23',
                'sources' => [],
            ],
            'insurance_bases' => [
                'label' => 'Bases, ratios y tasas sobre el valor del seguro',
                'config_path' => 'insurance.tc_base',
                'reviewed_at' => '2026-10-24',
                'sources' => [
                    'https://multicotizadorseguros.com/ar/guias/tabla-de-precios-seguros-autos-argentina',
                ],
            ],
            'insurance_zones' => [
                'label' => 'Factores de zona del seguro',
                'config_path' => 'insurance.zone_factor',
                'reviewed_at' => '2026-10-24',
                'sources' => [
                    'https://seguroya.com.ar/seguros-de-autos-precios',
                ],
            ],
            'service_toyota' => [
                'label' => 'Service Toyota (precios e intervalos)',
                'config_path' => 'service.brands.toyota',
                'reviewed_at' => '2026-10-24',
                'sources' => ['https://toyotayacopini.com/servicio-de-posventa/'],
            ],
            'service_volkswagen' => [
                'label' => 'Service Volkswagen (precios e intervalos)',
                'config_path' => 'service.brands.volkswagen',
                'reviewed_at' => '2026-10-24',
                'sources' => ['https://vwmataderos.com.ar/institucional/postventa/precios-de-servicio.htm'],
            ],
            'service_fiat' => [
                'label' => 'Service Fiat (precios e intervalos)',
                'config_path' => 'service.brands.fiat',
                'reviewed_at' => '2026-10-24',
                'sources' => [
                    'https://www.lanacion.com.ar/autos/servicie-oficial-del-auto-el-ranking-de-precios-de-las-automotrices-nid01102025/',
                ],
            ],
            'service_peugeot' => [
                'label' => 'Service Peugeot (precios e intervalos)',
                'config_path' => 'service.brands.peugeot',
                'reviewed_at' => '2026-10-24',
                'sources' => [
                    'https://www.lanacion.com.ar/autos/servicie-oficial-del-auto-el-ranking-de-precios-de-las-automotrices-nid01102025/',
                ],
            ],
            'service_fallback' => [
                'label' => 'Service de otras marcas (valores de referencia por carrocería)',
                'config_path' => 'service.fallback',
                'reviewed_at' => '2026-10-24',
                'sources' => [
                    'https://www.lanacion.com.ar/autos/servicie-oficial-del-auto-el-ranking-de-precios-de-las-automotrices-nid01102025/',
                ],
            ],
            'km_per_month' => [
                'label' => 'Kilómetros por mes de cada respuesta del diagnóstico',
                'config_path' => 'km_per_month',
                'reviewed_at' => '2026-10-23',
                'sources' => [],
            ],
            'cpi_base_months' => [
                'label' => 'Meses base del IPC de los montos en pesos',
                'config_path' => 'cpi_base_month',
                'reviewed_at' => '2026-10-24',
                'sources' => [],
            ],
        ],
    ],
];
