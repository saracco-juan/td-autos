<?php

namespace App\Services\Subscription;

/**
 * The receipt is no longer waiting for a decision (approved or rejected before).
 */
class ReceiptAlreadyReviewedException extends \RuntimeException {}
