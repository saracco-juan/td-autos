<?php

namespace App\Services\Integrations\MercadoLibre;

use Illuminate\Http\Client\Response;
use SensitiveParameter;
use stdClass;

final class MercadoLibreErrorDiagnostic
{
    public function project(#[SensitiveParameter] Response $response, #[SensitiveParameter] array $secrets): array
    {
        $contentType = strtolower(trim(explode(';', $response->header('Content-Type'))[0]));
        $result = ['content_type' => in_array($contentType, ['application/json', 'application/problem+json', 'text/html', 'text/plain'], true) ? $contentType : 'other'];
        $data = json_decode($response->body());
        if (! $data instanceof stdClass) {
            return $result;
        }
        $details = $this->fields($data, $secrets);
        $cause = $data->cause ?? null;
        if (is_array($cause)) {
            $details['cause'] = [];
            foreach (array_slice($cause, 0, 3) as $entry) {
                $projected = $entry instanceof stdClass ? $this->fields($entry, $secrets) : $this->scalar($entry, $secrets);
                if ($projected !== null && $projected !== []) {
                    $details['cause'][] = $projected;
                }
            }
        } elseif (($projected = $this->scalar($cause, $secrets)) !== null) {
            $details['cause'] = $projected;
        }
        if ($details !== []) {
            $result['provider_error'] = $details;
        }

        return $result;
    }

    private function fields(#[SensitiveParameter] stdClass $data, #[SensitiveParameter] array $secrets): array
    {
        $result = [];
        foreach (['error', 'code', 'blocked_by', 'status', 'message'] as $key) {
            $value = $this->scalar($data->{$key} ?? null, $secrets);
            if ($value !== null) {
                $result[$key] = $value;
            }
        }

        return $result;
    }

    private function scalar(#[SensitiveParameter] mixed $value, #[SensitiveParameter] array $secrets): string|int|float|null
    {
        if (! is_string($value) && ! is_int($value) && ! (is_float($value) && is_finite($value))) {
            return null;
        }
        $replacements = [];
        foreach ($secrets as $secret) {
            if (is_string($secret) && $secret !== '') {
                foreach ([$secret, rawurlencode($secret), urlencode($secret)] as $variant) {
                    $replacements[$variant] = '[redacted]';
                }
            }
        }
        // strtr replaces longest matches first, before bounds can expose a partial secret.
        $redacted = strtr((string) $value, $replacements);
        if (! is_string($value) && $redacted === (string) $value) {
            return $value;
        }

        return mb_strcut(preg_replace('/[\p{C}]/u', ' ', $redacted), 0, 256, 'UTF-8');
    }
}
