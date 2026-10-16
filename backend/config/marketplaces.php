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

    'sources' => ['mercadolibre'],

    'recorded_path' => [
        'mercadolibre' => database_path('data/mercadolibre/search-autos.json'),
    ],

];
