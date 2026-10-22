<?php

return [

    /*
    |--------------------------------------------------------------------------
    | External Cron Secret
    |--------------------------------------------------------------------------
    |
    | Bearer token required by the internal cron endpoints, which an external
    | scheduler calls because the host has no cron. Empty disables them (404).
    |
    */

    'secret' => env('CRON_SECRET'),

];
