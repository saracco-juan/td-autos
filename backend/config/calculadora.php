<?php

// Rates of the ownership cost calculator (HU10 / RF09), reviewed on `updated_at`.
//
// The PATENTE and the INSURANCE are CENTRAL estimates (UH-10). The patente follows the 2026 rule of each jurisdiction and,
// where a province has no rule here, takes the median flat rate; the insurance is a floor plus a rate over the price,
// fitted on the validation survey. The other concepts (service, fuel, transfer) are still the UPPER end of their range,
// a ceiling, until their own tasks move them to a central estimate.
// No primary source was reachable for the ceiling values; they come from secondary sources (news, public calculators,
// dealer price lists), taking the max across them. The patente rules of CABA, Mendoza, Misiones and Santa Fe come from
// the official 2026 laws and tariffs (see `patente` below).
// Update the values and `updated_at` together, by commit.

return [
    // Date the rates were last reviewed (shown on the screen as "valores actualizados al ...").
    'updated_at' => '2026-10-24',

    // Month (YYYY-MM) in which the ARS amounts below (transfer.fixed_costs) are stated.
    // The insurance floor, patente and each service brand (and the service fallback) state their ARS amounts at their own `cpi_base_month`.
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

    // Car insurance, per month, in two coverages. A CENTRAL estimate (UH-10), not a ceiling.
    //
    // Terceros completo (TC) = ceil_step((tc_floor + tc_value_rate x price) x zone_factor[province]).
    // Todo riesgo (TR)       = ceil_step(TC x tr_ratio).
    // `price` is the ARS price base of the calculator. The ratio multiplies the TC already rounded up, so the screen can
    // explain TR from the TC it shows. A province outside zone_factor (or an unknown one) takes `default`.
    // The body type and the age of the car are NOT modeled: the price already carries the class and the age.
    //
    // Fit: `tc_floor` and `tc_value_rate` were fitted on the 6 AMBA terceros-completo points of the validation survey
    // (Oct 2026). They are the only fitted parameters; the sources below give ranges, not a premium by model + year + zone.
    //
    // Sources:
    //  - tr_ratio: multicotizadorseguros.com price table (TR and TC ranges by class, 2024 units) and cuantomecuesta.com
    //    (a deductible lowers TR 20-35%): a TR with franquicia is about 1.5 x TC.
    //    https://multicotizadorseguros.com/ar/guias/tabla-de-precios-seguros-autos-argentina
    //  - zone_factor: seguroya.com.ar zone ranges for a mid-size TC (CABA, Cordoba, Rosario, Mendoza) and cuantomecuesta.com
    //    (interior 0.60-0.75 of AMBA), against AMBA = 1.0. Provinces without a published range use `default`.
    //    https://seguroya.com.ar/seguros-de-autos-precios
    //  - Order of magnitude of the value rate: hacecuentas, 2.5-3.5% of the value a year (unverified).
    //
    // Yearly review: tc_floor (ARS), tc_value_rate, tr_ratio and zone_factor, together with `updated_at`.
    'insurance' => [
        // ARS per month at AMBA prices, stated at `cpi_base_month`. The monthly refresh scales it by
        // max(1, CPI latest / CPI of that month). It is the only ARS amount of the insurance: the rates are never indexed.
        'tc_floor' => 46000,
        // Fraction of the vehicle price per MONTH added to the floor (0.37% a month = 4.4% a year).
        'tc_value_rate' => 0.0037,
        // Todo riesgo con franquicia as a multiple of the rounded terceros completo.
        'tr_ratio' => 1.5,
        'zone_factor' => [
            'caba' => 1.00,
            'buenos_aires' => 1.00,
            'cordoba' => 0.80,
            'santa_fe' => 0.80,
            'mendoza' => 0.72,
            'default' => 0.70,
        ],
        // Month (YYYY-MM) of the tc_floor amount; independent from the top-level `cpi_base_month`.
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

    // Annual vehicle tax (patente), by normalized province: a CENTRAL estimate of the nominal annual tax (no early-payment
    // or good-standing discounts), divided by 12 and rounded up. The base is the ACARA value of the version when known,
    // otherwise the listing price. Age = current year - model year (never negative).
    //
    // Rate scheme of each province, the first that applies:
    //  - `scale`: progressive scale. Each bracket is {up_to, fixed, rate}: tax = fixed + rate x (value - previous up_to);
    //    the last bracket has up_to null. A value equal to a limit belongs to the bracket that ends there.
    //  - `bracket_rate`: one rate for the WHOLE value, chosen by the bracket {up_to, rate} the value falls in.
    //  - `body_rate[utility]`: one rate for pickups and SUVs (`utility_bodies`); an unknown body type is NOT a utility.
    //  - `age_rate`: one rate for the WHOLE value, chosen by the age: bands {up_to_age, rate}, an age equal to up_to_age
    //    belongs to that band; the last band has up_to_age null (it also covers the oldest cars).
    //  - `body_rate[car]`: one rate for every other body type.
    //  - `flat_rate`: one rate over the value. A province outside every map takes the MEDIAN flat rate (central estimate).
    // `utility_bodies` uses the body slugs of the calculator: pickup and SUV count as utility; furgón, rural, sedán and
    // hatchback are cars (a furgón is cargo, but no source gives it its own rate).
    //
    // `rules[province]` adjusts the tax of the scheme, in this order:
    //  - `exempt_from_age`: a vehicle of that age or older pays nothing. "Older than 20 years" is written 21.
    //  - `surcharge`: fraction added on top of the tax (0.10 = +10%).
    //  - `cap`: maximum tax as a fraction of the value, applied after the surcharge.
    //  - `minimum`: minimum tax per year in ARS, applied last.
    //
    // Sources (2026):
    //  - CABA: Ley 6927 art. 50 (scale, +10% surcharge, 6% cap, minimum 13,300, exempt from 25 years). Pickups use the
    //    general scale, as UADE does, not the 2.30% cargo line.
    //    https://documentosboletinoficial.buenosaires.gob.ar/publico/PL-LEY-LCABA-LCBA-6927-25-ANX.pdf
    //    Exemptions: https://www.ambito.com/economia/patentes-2026-que-vehiculos-estan-exentos-caba-y-cuales-empiezan-pagar-n6239557
    //  - Buenos Aires: ARBA 2026 scale, Infobae 2026-02-12. Exempt from 25 years (the municipality collects the vehicles
    //    of 10 to 24 years with the provincial calculation, so they keep paying it here).
    //    https://www.infobae.com/economia/2026/02/12/confirmado-a-partir-de-marzo-las-patentes-bonaerenses-comenzaran-a-pagarse-todos-los-meses/
    //    https://www.infozona.com.ar/?p=389634
    //  - Mendoza: Ley Impositiva 2026, one rate over the whole value by bracket.
    //    https://atm.mendoza.gov.ar/wp-content/uploads/2025/12/Ley-Impositiva-2026.pdf
    //  - Misiones: Ley XXII N 25 (2% cars, 0.8% utility vehicles, cars exempt when older than 20 years) and RG 29/2025.
    //    Only pickups are taken as utility vehicles: the survey shows an SUV paying the car rate.
    //    https://digestomisiones.gob.ar/archivospdf/1688643175_Ley%20XXII%20-%20N%2025.pdf
    //    https://atmisiones.gob.ar/wp-content/uploads/2026/02/RG-29-2025-y-RG-Hacienda-1505-2025.pdf
    //  - Santa Fe: Ley impositiva anual, patente unica sobre vehiculos (arts. 55 a 58): cars by age (up to 5 years 2.3%,
    //    over 5 to 10 2.0%, over 10 1.8%), pickups and SUVs 2.0%. The fixed amount that the law sets for cars of more
    //    than 15 years was not found: they keep the last band.
    //    https://www.santafe.gov.ar/index.php/web/content/download/135407/669723/file/07%20LIA%20Patente%20%C3%9Anica%20sobre%20Veh%C3%ADculos%20(Art%C3%ADculos%2055%20a%2058).pdf
    //  - Córdoba: hacecuentas.com 2026 (unofficial calculator). The 2026 brackets were NOT found and these values are about
    //    2x the effective rates: Córdoba is the least reliable patente of this file.
    //    https://hacecuentas.com/calculadora-patente-auto-cordoba-2026-valuacion-fiscal-cuotas
    //  - Flat rates: UADE 2026 (https://uade.edu.ar/media/ibydidl3/uade-costo-patentes-de-automoviles.pdf); Entre Rios,
    //    San Luis and La Pampa at the middle of the effective range; Chaco, Santa Cruz and Santiago del Estero have no
    //    data and keep their previous value. Neuquen exempt from 20 years (secondary source).
    //
    // CPI: the ARS amounts (bracket limits, fixed amounts and `minimum`) are scaled by the monthly refresh, never the
    // rates, percentages or ages. See `cpi_base_month` and `province_cpi_base_month`.
    //
    // Yearly review: the schemes, rules and flat rates, together with the base months and `updated_at`.
    'patente' => [
        // Month (YYYY-MM) of the ARS amounts of the provinces that do not appear in `province_cpi_base_month`
        // (ARBA scale: Feb-2026). The monthly refresh scales them by max(1, CPI latest / CPI of that month).
        'cpi_base_month' => '2026-02',
        // Provinces whose law states the amounts at another month: CABA (Ley 6927) and Mendoza (Ley Impositiva 2026) apply
        // from January 2026, so their amounts are indexed from 2026-01.
        'province_cpi_base_month' => [
            'caba' => '2026-01',
            'mendoza' => '2026-01',
        ],
        'utility_bodies' => ['pickup', 'suv'],
        'scale' => [
            'buenos_aires' => [
                ['up_to' => 14100000, 'fixed' => 0, 'rate' => 0.01],
                ['up_to' => 18700000, 'fixed' => 141000, 'rate' => 0.02],
                ['up_to' => 26100000, 'fixed' => 233000, 'rate' => 0.03],
                ['up_to' => 53900000, 'fixed' => 455000, 'rate' => 0.04],
                ['up_to' => null, 'fixed' => 1567000, 'rate' => 0.045],
            ],
            // Ley 6927 art. 50, before the 10% surcharge.
            'caba' => [
                ['up_to' => 7460000, 'fixed' => 0, 'rate' => 0.016],
                ['up_to' => 17155000, 'fixed' => 119350, 'rate' => 0.04],
                ['up_to' => 26850000, 'fixed' => 507150, 'rate' => 0.045],
                ['up_to' => 36550000, 'fixed' => 943500, 'rate' => 0.055],
                ['up_to' => 50350000, 'fixed' => 1477000, 'rate' => 0.065],
                ['up_to' => 73100000, 'fixed' => 2374000, 'rate' => 0.07],
                ['up_to' => null, 'fixed' => 3965000, 'rate' => 0.08],
            ],
        ],
        'bracket_rate' => [
            // 2026 brackets not found: these values are about 2x the effective rates (see the sources above).
            'cordoba' => [
                ['up_to' => 5000000, 'rate' => 0.015],
                ['up_to' => 10000000, 'rate' => 0.02],
                ['up_to' => 20000000, 'rate' => 0.025],
                ['up_to' => 50000000, 'rate' => 0.03],
                ['up_to' => 100000000, 'rate' => 0.0375],
                ['up_to' => null, 'rate' => 0.045],
            ],
            'mendoza' => [
                ['up_to' => 7100000, 'rate' => 0.015],
                ['up_to' => 14200000, 'rate' => 0.016],
                ['up_to' => 23700000, 'rate' => 0.017],
                ['up_to' => 35500000, 'rate' => 0.018],
                ['up_to' => 47300000, 'rate' => 0.02],
                ['up_to' => 59100000, 'rate' => 0.0225],
                ['up_to' => 87500000, 'rate' => 0.025],
                ['up_to' => null, 'rate' => 0.03],
            ],
        ],
        // Cars by age (Santa Fe): up to 5 years, over 5 up to 10, over 10.
        'age_rate' => [
            'santa_fe' => [
                ['up_to_age' => 5, 'rate' => 0.023],
                ['up_to_age' => 10, 'rate' => 0.02],
                ['up_to_age' => null, 'rate' => 0.018],
            ],
        ],
        // Rate by body type: `utility` for the utility bodies, `car` for the rest (Misiones). Santa Fe only sets the
        // utility rate: its cars go by age. A province's `utility_bodies` replaces the general list: in Misiones only
        // pickups pay the utility rate (validation survey, 2026-10: a 2018 SUV pays about 2% of its value).
        'body_rate' => [
            'misiones' => ['car' => 0.02, 'utility' => 0.008, 'utility_bodies' => ['pickup']],
            'santa_fe' => ['utility' => 0.02],
        ],
        'rules' => [
            'caba' => ['surcharge' => 0.10, 'cap' => 0.06, 'minimum' => 13300, 'exempt_from_age' => 25],
            'buenos_aires' => ['exempt_from_age' => 25],
            'misiones' => ['exempt_from_age' => 21], // older than 20 years
            'neuquen' => ['exempt_from_age' => 20],
        ],
        'flat_rate' => [
            'catamarca' => 0.02, 'chaco' => 0.022,
            'chubut' => 0.027, 'corrientes' => 0.025, 'entre_rios' => 0.034,
            'formosa' => 0.02, 'jujuy' => 0.02, 'la_pampa' => 0.025, 'la_rioja' => 0.025,
            'neuquen' => 0.02, 'rio_negro' => 0.035,
            'salta' => 0.02, 'san_juan' => 0.02, 'san_luis' => 0.036, 'santa_cruz' => 0.028,
            'santiago_del_estero' => 0.018, 'tierra_del_fuego' => 0.025,
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
    // It never changes a rate. After reviewing a group, move its `reviewed_at` to the review date (see docs/development/calculator.md).
    // Groups without `sources` have no public source; they are judgment or sourced only from the notes above.
    'review' => [
        'max_age_months' => 12,
        // The monthly snapshot (calculadora:refresh) is reported late when the latest valid one is older than this.
        'snapshot_max_age_days' => 40,
        'groups' => [
            'patente_scale' => [
                'label' => 'Escalas de patente (Buenos Aires y CABA)',
                'config_path' => 'patente.scale',
                'reviewed_at' => '2026-10-26',
                'sources' => [
                    'https://www.infobae.com/economia/2026/02/12/confirmado-a-partir-de-marzo-las-patentes-bonaerenses-comenzaran-a-pagarse-todos-los-meses/',
                    'https://documentosboletinoficial.buenosaires.gob.ar/publico/PL-LEY-LCABA-LCBA-6927-25-ANX.pdf',
                ],
            ],
            'patente_rules' => [
                'label' => 'Recargo, tope, mínimo y exención por antigüedad de la patente',
                'config_path' => 'patente.rules',
                'reviewed_at' => '2026-10-26',
                'sources' => [
                    'https://documentosboletinoficial.buenosaires.gob.ar/publico/PL-LEY-LCABA-LCBA-6927-25-ANX.pdf',
                    'https://www.ambito.com/economia/patentes-2026-que-vehiculos-estan-exentos-caba-y-cuales-empiezan-pagar-n6239557',
                    'https://www.infozona.com.ar/?p=389634',
                    'https://digestomisiones.gob.ar/archivospdf/1688643175_Ley%20XXII%20-%20N%2025.pdf',
                ],
            ],
            'patente_mendoza' => [
                'label' => 'Tramos de patente de Mendoza',
                'config_path' => 'patente.bracket_rate.mendoza',
                'reviewed_at' => '2026-10-26',
                'sources' => [
                    'https://atm.mendoza.gov.ar/wp-content/uploads/2025/12/Ley-Impositiva-2026.pdf',
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
            'patente_by_age_and_body' => [
                'label' => 'Patente por antigüedad y carrocería (Santa Fe y Misiones)',
                'config_path' => 'patente.age_rate',
                'reviewed_at' => '2026-10-26',
                'sources' => [
                    'https://www.santafe.gov.ar/index.php/web/content/download/135407/669723/file/07%20LIA%20Patente%20%C3%9Anica%20sobre%20Veh%C3%ADculos%20(Art%C3%ADculos%2055%20a%2058).pdf',
                    'https://digestomisiones.gob.ar/archivospdf/1688643175_Ley%20XXII%20-%20N%2025.pdf',
                    'https://atmisiones.gob.ar/wp-content/uploads/2026/02/RG-29-2025-y-RG-Hacienda-1505-2025.pdf',
                ],
            ],
            'patente_flat' => [
                'label' => 'Alícuotas de patente (otras provincias)',
                'config_path' => 'patente.flat_rate',
                'reviewed_at' => '2026-10-26',
                'sources' => [
                    'https://uade.edu.ar/media/ibydidl3/uade-costo-patentes-de-automoviles.pdf',
                ],
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
            'insurance_model' => [
                'label' => 'Piso, tasa sobre el valor y relación todo riesgo del seguro',
                'config_path' => 'insurance.tc_floor',
                'reviewed_at' => '2026-10-27',
                'sources' => [
                    'https://multicotizadorseguros.com/ar/guias/tabla-de-precios-seguros-autos-argentina',
                    'https://hacecuentas.com',
                ],
            ],
            'insurance_zones' => [
                'label' => 'Factores de zona del seguro',
                'config_path' => 'insurance.zone_factor',
                'reviewed_at' => '2026-10-27',
                'sources' => [
                    'https://seguroya.com.ar/seguros-de-autos-precios',
                    'https://cuantomecuesta.com',
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
