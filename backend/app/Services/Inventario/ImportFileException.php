<?php

namespace App\Services\Inventario;

/**
 * The uploaded CSV cannot be imported as a whole (empty, wrong columns, too many rows, ...).
 * The message is shown to the dealer.
 */
class ImportFileException extends \RuntimeException {}
