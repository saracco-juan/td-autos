<?php

namespace App\Support;

final class TransferData
{
    private const KEYS = ['holder', 'cuit', 'bank', 'cbu', 'alias', 'monthly_amount'];

    /**
     * The bank transfer data a dealer needs to pay, or null unless every value is configured.
     *
     * @return array{holder: string, cuit: string, bank: string, cbu: string, alias: string, monthly_amount: string}|null
     */
    public static function fromConfig(): ?array
    {
        $config = config('payments.transfer', []);
        $data = [];

        foreach (self::KEYS as $key) {
            $value = trim((string) ($config[$key] ?? ''));
            if ($value === '') {
                return null;
            }
            $data[$key] = $value;
        }

        return $data;
    }
}
