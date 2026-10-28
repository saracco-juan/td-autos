<?php

return [
    // Explicitly confirmed international numbers, digits only, separated by commas.
    // An ordinary public phone is never enough to enable WhatsApp contact.
    'confirmed_numbers' => array_values(array_filter(array_map('trim', explode(',', (string) env('DEALER_WHATSAPP_NUMBERS', ''))))),
];
