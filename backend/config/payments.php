<?php

use App\Support\EmailList;

return [

    /*
    |--------------------------------------------------------------------------
    | Bank Transfer Data
    |--------------------------------------------------------------------------
    |
    | Account data shown to dealers so they can pay the subscription by bank
    | transfer. If any value is missing the data is considered unavailable.
    |
    */

    'transfer' => [
        'holder' => env('TRANSFER_HOLDER'),
        'cuit' => env('TRANSFER_CUIT'),
        'bank' => env('TRANSFER_BANK'),
        'cbu' => env('TRANSFER_CBU'),
        'alias' => env('TRANSFER_ALIAS'),
        'monthly_amount' => env('SUBSCRIPTION_MONTHLY_AMOUNT'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Administrator Notification Emails
    |--------------------------------------------------------------------------
    |
    | Addresses notified when a dealer uploads a payment receipt
    | (comma separated in ADMIN_NOTIFICATION_EMAILS).
    |
    */

    'admin_emails' => EmailList::parse(env('ADMIN_NOTIFICATION_EMAILS')),

];
