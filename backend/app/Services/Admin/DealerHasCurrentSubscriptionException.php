<?php

namespace App\Services\Admin;

/**
 * The dealer's subscription is valid or in grace, so the dealer cannot be deleted.
 */
class DealerHasCurrentSubscriptionException extends \RuntimeException {}
