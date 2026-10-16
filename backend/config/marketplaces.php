<?php

return [

    /*
    |--------------------------------------------------------------------------
    | External marketplaces (RF05, RNF06)
    |--------------------------------------------------------------------------
    |
    | `sources` lists the enabled marketplace keys; `timeout` (seconds) and `limit` apply to each
    | source. `recorded_path` holds the demo response read by the `recorded` driver.
    |
    */

    'timeout' => (int) env('MARKETPLACES_TIMEOUT', 5),

    'limit' => 50,

    // Minutes an external refresh (and its ok / sin_respuesta outcome) is reused before the sources are called again.
    'refresh_minutes' => (int) env('MARKETPLACES_REFRESH_MINUTES', 15),

    'sources' => ['mercadolibre'],

    'recorded_path' => [
        'mercadolibre' => database_path('data/mercadolibre/search-autos.json'),
    ],

];
