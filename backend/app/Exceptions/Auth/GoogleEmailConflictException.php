<?php

namespace App\Exceptions\Auth;

use RuntimeException;

/**
 * Thrown when a Google identity cannot be safely attached to an existing account.
 */
class GoogleEmailConflictException extends RuntimeException {}
