<?php

return [

    /*
    | URL prefixes the mobile app may be sent back to after signing in with Google.
    | Comma-separated in MOBILE_REDIRECT_PREFIXES. "exp://" (Expo Go) is added outside production.
    */
    'redirect_prefixes' => array_values(array_filter(array_map(
        'trim',
        explode(',', (string) env('MOBILE_REDIRECT_PREFIXES', 'tdautos://')),
    ))),

    // Lifetime of the one-time code the app exchanges for an API token.
    'google_code_ttl' => 60,

];
