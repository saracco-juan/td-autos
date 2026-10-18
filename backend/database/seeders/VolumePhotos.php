<?php

namespace Database\Seeders;

use App\Support\VehiculoFotos;
use App\Support\VehiculoOptions;

/**
 * The placeholder pictures of the volume seed: a few numbered PNG files written once to the vehicle
 * photos disk and shared by every vehicle, so the gallery shows real images and photo N shows the digit N.
 * Drawn by hand (no GD needed): a vertical gradient with a big digit.
 */
final class VolumePhotos
{
    private const FOLDER = 'vehiculos/volumen';

    private const WIDTH = 640;

    private const HEIGHT = 480;

    private const SCALE = 40;

    /** @var list<array{int, int, int}> */
    private const COLORS = [
        [96, 125, 139], [121, 134, 203], [77, 182, 172], [230, 150, 40],
        [200, 80, 120], [120, 170, 90], [140, 110, 100],
    ];

    /** 5x7 bitmaps of the digits 1 to 7. */
    private const GLYPHS = [
        1 => ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
        2 => ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
        3 => ['.###.', '#...#', '....#', '..##.', '....#', '#...#', '.###.'],
        4 => ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
        5 => ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
        6 => ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
        7 => ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
    ];

    /**
     * Write the pictures and return their locations, indexed by photo order (1 to FOTOS_MINIMO).
     *
     * @return array<int, string>
     */
    public static function ensure(): array
    {
        $paths = [];

        for ($order = 1; $order <= VehiculoOptions::FOTOS_MINIMO; $order++) {
            $path = self::FOLDER."/foto-{$order}.png";
            VehiculoFotos::disk()->put($path, self::png($order), 'public');
            $paths[$order] = $path;
        }

        return $paths;
    }

    private static function png(int $digit): string
    {
        $color = self::COLORS[$digit - 1];
        $glyph = self::GLYPHS[$digit];
        $glyphWidth = strlen($glyph[0]) * self::SCALE;
        $left = intdiv(self::WIDTH - $glyphWidth, 2);
        $top = intdiv(self::HEIGHT - count($glyph) * self::SCALE, 2);
        $white = "\xFF\xFF\xFF";

        $raw = '';
        for ($y = 0; $y < self::HEIGHT; $y++) {
            $shade = 1 - 0.35 * $y / self::HEIGHT;
            $background = chr((int) ($color[0] * $shade)).chr((int) ($color[1] * $shade)).chr((int) ($color[2] * $shade));
            $line = '';

            $glyphRow = intdiv($y - $top, self::SCALE);
            if ($y >= $top && isset($glyph[$glyphRow])) {
                $line = str_repeat($background, $left);
                foreach (str_split($glyph[$glyphRow]) as $cell) {
                    $line .= str_repeat($cell === '#' ? $white : $background, self::SCALE);
                }
                $line .= str_repeat($background, self::WIDTH - $left - $glyphWidth);
            } else {
                $line = str_repeat($background, self::WIDTH);
            }

            $raw .= "\0".$line;
        }

        return "\x89PNG\r\n\x1A\n"
            .self::chunk('IHDR', pack('NNCCCCC', self::WIDTH, self::HEIGHT, 8, 2, 0, 0, 0))
            .self::chunk('IDAT', gzcompress($raw, 9))
            .self::chunk('IEND', '');
    }

    private static function chunk(string $type, string $data): string
    {
        return pack('N', strlen($data)).$type.$data.pack('N', crc32($type.$data));
    }
}
