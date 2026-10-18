<?php

namespace Database\Seeders;

/**
 * Static data behind the volume seed (`db:local --vehiculos=N`): real Argentine-market models with
 * their body type and a reference price, and made-up dealers placed in real towns.
 */
final class VolumeCatalog
{
    /**
     * Brand, model, version, body type (`tipo_carroceria.nombre`), reference price in millions of
     * pesos for a 2022 unit, fuel, transmission (m = manual, a = automatic, x = either) and the
     * first model year on the market.
     *
     * @var list<array{string, string, string, string, float, string, string, int}>
     */
    public const MODELS = [
        ['Volkswagen', 'Gol Trend', 'Trendline 1.6', 'Hatchback', 15, 'nafta', 'm', 2008],
        ['Volkswagen', 'Fox', 'Comfortline 1.6', 'Hatchback', 14, 'nafta', 'm', 2008],
        ['Volkswagen', 'Up!', 'Move 1.0', 'Hatchback', 13.5, 'nafta', 'm', 2014],
        ['Volkswagen', 'Polo', 'Track 1.6', 'Hatchback', 19, 'nafta', 'm', 2018],
        ['Volkswagen', 'Polo', 'Highline 1.6 AT', 'Hatchback', 24, 'nafta', 'a', 2018],
        ['Volkswagen', 'Vento', 'Comfortline 1.4 TSI', 'Sedán', 22, 'nafta', 'x', 2011],
        ['Volkswagen', 'Virtus', 'Highline 1.6 AT', 'Sedán', 25, 'nafta', 'a', 2018],
        ['Volkswagen', 'Suran', 'Comfortline 1.6', 'Rural / familiar', 15, 'nafta', 'm', 2008],
        ['Volkswagen', 'T-Cross', 'Highline 200 TSI', 'SUV', 31, 'nafta', 'a', 2019],
        ['Volkswagen', 'Tiguan', 'Allspace 350 TSI', 'SUV', 42, 'nafta', 'a', 2018],
        ['Volkswagen', 'Saveiro', 'Cabina Extendida 1.6', 'Pickup', 17, 'nafta', 'm', 2008],
        ['Volkswagen', 'Amarok', 'V6 Highline 3.0 TDI', 'Pickup', 52, 'diesel', 'a', 2010],
        ['Chevrolet', 'Onix', 'LT 1.4', 'Hatchback', 17, 'nafta', 'm', 2013],
        ['Chevrolet', 'Onix Plus', 'Premier 1.0 Turbo AT', 'Sedán', 25, 'nafta', 'a', 2020],
        ['Chevrolet', 'Cruze', 'LTZ 1.4 Turbo', 'Sedán', 23, 'nafta', 'x', 2012],
        ['Chevrolet', 'Cruze 5', 'LTZ 1.4 Turbo', 'Hatchback', 24, 'nafta', 'x', 2017],
        ['Chevrolet', 'Tracker', 'Premier 1.2 Turbo AT', 'SUV', 29, 'nafta', 'a', 2020],
        ['Chevrolet', 'Spin', 'LTZ 1.8', 'Rural / familiar', 22, 'nafta', 'x', 2013],
        ['Chevrolet', 'S10', 'LTZ 2.8 4x4', 'Pickup', 46, 'diesel', 'a', 2012],
        ['Ford', 'Ka', 'SE 1.5', 'Hatchback', 14.5, 'nafta', 'm', 2016],
        ['Ford', 'Focus', 'SE Plus 2.0', 'Hatchback', 17, 'nafta', 'x', 2014],
        ['Ford', 'EcoSport', 'SE 1.5', 'SUV', 20, 'nafta', 'x', 2013],
        ['Ford', 'Kuga', 'Titanium 2.0', 'SUV', 28, 'nafta', 'a', 2013],
        ['Ford', 'Territory', 'Titanium 1.5 Turbo', 'SUV', 38, 'nafta', 'a', 2021],
        ['Ford', 'Ranger', 'XLS 3.2 4x4', 'Pickup', 45, 'diesel', 'x', 2012],
        ['Toyota', 'Etios', 'XLS 1.5', 'Hatchback', 16, 'nafta', 'm', 2013],
        ['Toyota', 'Yaris', 'XLS 1.5 CVT', 'Hatchback', 22, 'nafta', 'x', 2018],
        ['Toyota', 'Corolla', 'XEI 2.0 CVT', 'Sedán', 33, 'nafta', 'a', 2009],
        ['Toyota', 'Corolla', 'SEG Hybrid 1.8', 'Sedán', 44, 'hibrido', 'a', 2020],
        ['Toyota', 'Corolla Cross', 'XEI 2.0', 'SUV', 38, 'nafta', 'a', 2022],
        ['Toyota', 'RAV4', 'Hybrid 2.5 AWD', 'SUV', 58, 'hibrido', 'a', 2019],
        ['Toyota', 'Hilux', 'SRV 2.8 4x4', 'Pickup', 62, 'diesel', 'x', 2008],
        ['Toyota', 'SW4', 'SRX 2.8 4x4', 'SUV', 70, 'diesel', 'a', 2008],
        ['Renault', 'Kwid', 'Intens 1.0', 'Hatchback', 13, 'nafta', 'm', 2018],
        ['Renault', 'Sandero', 'Stepway 1.6', 'Hatchback', 17, 'nafta', 'm', 2008],
        ['Renault', 'Logan', 'Intens 1.6', 'Sedán', 16, 'nafta', 'm', 2008],
        ['Renault', 'Duster', 'Intens 1.6', 'SUV', 22, 'nafta', 'x', 2011],
        ['Renault', 'Captur', 'Intens 2.0', 'SUV', 24, 'nafta', 'x', 2017],
        ['Renault', 'Kangoo', 'Express Confort 1.6', 'Furgón', 17, 'nafta', 'm', 2008],
        ['Renault', 'Oroch', 'Dynamique 1.6', 'Pickup', 24, 'nafta', 'x', 2016],
        ['Renault', 'Alaskan', 'Intens 2.3 dCi', 'Pickup', 44, 'diesel', 'a', 2018],
        ['Fiat', 'Palio', 'Attractive 1.4', 'Hatchback', 10, 'nafta', 'm', 2008],
        ['Fiat', 'Uno', 'Way 1.4', 'Hatchback', 12, 'nafta', 'm', 2011],
        ['Fiat', 'Argo', 'HGT 1.8', 'Hatchback', 19, 'nafta', 'a', 2017],
        ['Fiat', 'Cronos', 'Drive 1.3', 'Sedán', 18, 'nafta', 'm', 2018],
        ['Fiat', 'Pulse', 'Drive 1.3 Turbo', 'SUV', 25, 'nafta', 'a', 2022],
        ['Fiat', 'Fiorino', 'Fire 1.4', 'Furgón', 13, 'nafta', 'm', 2008],
        ['Fiat', 'Ducato', 'Maxicargo 2.3 JTD', 'Furgón', 36, 'diesel', 'm', 2008],
        ['Fiat', 'Strada', 'Freedom 1.3', 'Pickup', 22, 'nafta', 'm', 2020],
        ['Fiat', 'Toro', 'Freedom 2.0 Diesel', 'Pickup', 41, 'diesel', 'a', 2016],
        ['Peugeot', '208', 'Allure 1.6', 'Hatchback', 20, 'nafta', 'x', 2015],
        ['Peugeot', '308', 'Allure 1.6 THP', 'Hatchback', 17, 'nafta', 'x', 2012],
        ['Peugeot', '408', 'Allure 2.0', 'Sedán', 20, 'nafta', 'x', 2011],
        ['Peugeot', '2008', 'Allure 1.6', 'SUV', 27, 'nafta', 'a', 2016],
        ['Peugeot', 'Partner', 'Patagónica 1.6 HDi', 'Rural / familiar', 18, 'diesel', 'm', 2008],
        ['Peugeot', 'Expert', 'Premium 2.0 HDi', 'Furgón', 38, 'diesel', 'm', 2017],
        ['Citroën', 'C3', 'Feel 1.6', 'Hatchback', 15, 'nafta', 'm', 2012],
        ['Citroën', 'C4 Cactus', 'Feel 1.6', 'SUV', 21, 'nafta', 'a', 2018],
        ['Citroën', 'Berlingo', 'Business 1.6 HDi', 'Rural / familiar', 17, 'diesel', 'm', 2008],
        ['Nissan', 'Versa', 'Advance 1.6', 'Sedán', 19, 'nafta', 'x', 2012],
        ['Nissan', 'Kicks', 'Exclusive 1.6 CVT', 'SUV', 27, 'nafta', 'a', 2017],
        ['Nissan', 'Frontier', 'Platinum 2.3 4x4', 'Pickup', 48, 'diesel', 'a', 2008],
        ['Honda', 'Civic', 'EXL 2.0', 'Sedán', 31, 'nafta', 'a', 2008],
        ['Honda', 'HR-V', 'EXL 1.8', 'SUV', 36, 'nafta', 'a', 2016],
        ['Jeep', 'Renegade', 'Sport 1.8', 'SUV', 28, 'nafta', 'x', 2016],
        ['Jeep', 'Compass', 'Limited 2.4', 'SUV', 41, 'nafta', 'a', 2017],
        ['Hyundai', 'Tucson', 'GLS 2.0', 'SUV', 30, 'nafta', 'a', 2012],
        ['Mercedes-Benz', 'Sprinter', '415 CDI Furgón', 'Furgón', 50, 'diesel', 'm', 2008],
    ];

    /**
     * Dealer name, town and province.
     *
     * @var list<array{string, string, string}>
     */
    public const DEALERS = [
        ['Automotores del Plata', 'La Plata', 'Buenos Aires'],
        ['Costa Atlántica Autos', 'Mar del Plata', 'Buenos Aires'],
        ['Bahía Motors', 'Bahía Blanca', 'Buenos Aires'],
        ['Autos Serranos', 'Tandil', 'Buenos Aires'],
        ['Pilar Automotores', 'Pilar', 'Buenos Aires'],
        ['Quilmes Usados Premium', 'Quilmes', 'Buenos Aires'],
        ['San Isidro Cars', 'San Isidro', 'Buenos Aires'],
        ['Junín Rodados', 'Junín', 'Buenos Aires'],
        ['Olavarría Automotores', 'Olavarría', 'Buenos Aires'],
        ['Palermo Motors', 'CABA', 'Ciudad Autónoma de Buenos Aires'],
        ['Belgrano Autos', 'CABA', 'Ciudad Autónoma de Buenos Aires'],
        ['Cba Automotores', 'Córdoba', 'Córdoba'],
        ['Río Cuarto Motors', 'Río Cuarto', 'Córdoba'],
        ['Villa María Usados', 'Villa María', 'Córdoba'],
        ['Punilla Autos', 'Villa Carlos Paz', 'Córdoba'],
        ['Rosario Premium Cars', 'Rosario', 'Santa Fe'],
        ['Santa Fe Automotores', 'Santa Fe', 'Santa Fe'],
        ['Rafaela Rodados', 'Rafaela', 'Santa Fe'],
        ['Venado Autos', 'Venado Tuerto', 'Santa Fe'],
        ['Andes Automotores', 'Mendoza', 'Mendoza'],
        ['San Rafael Motors', 'San Rafael', 'Mendoza'],
        ['Tucumán Usados', 'San Miguel de Tucumán', 'Tucumán'],
        ['Jardín Autos', 'San Miguel de Tucumán', 'Tucumán'],
        ['Salta la Linda Motors', 'Salta', 'Salta'],
        ['Quebrada Automotores', 'San Salvador de Jujuy', 'Jujuy'],
        ['Neuquén Pick-Ups', 'Neuquén', 'Neuquén'],
        ['Patagonia Andina Autos', 'San Carlos de Bariloche', 'Río Negro'],
        ['Golfo Automotores', 'Comodoro Rivadavia', 'Chubut'],
        ['Valle del Chubut Motors', 'Trelew', 'Chubut'],
        ['Austral Rodados', 'Río Gallegos', 'Santa Cruz'],
        ['Fin del Mundo Autos', 'Ushuaia', 'Tierra del Fuego'],
        ['Misiones Automotores', 'Posadas', 'Misiones'],
        ['Corrientes Motors', 'Corrientes', 'Corrientes'],
        ['Chaco Usados', 'Resistencia', 'Chaco'],
        ['Formosa Rodados', 'Formosa', 'Formosa'],
        ['Paraná Automotores', 'Paraná', 'Entre Ríos'],
        ['Concordia Cars', 'Concordia', 'Entre Ríos'],
        ['Sol de San Juan Autos', 'San Juan', 'San Juan'],
        ['San Luis Motors', 'San Luis', 'San Luis'],
        ['Rioja Automotores', 'La Rioja', 'La Rioja'],
        ['Catamarca Usados', 'San Fernando del Valle de Catamarca', 'Catamarca'],
        ['Santiagueña Rodados', 'Santiago del Estero', 'Santiago del Estero'],
        ['Pampa Norte Autos', 'General Pico', 'La Pampa'],
        ['Avenida Libertador Motors', 'San Isidro', 'Buenos Aires'],
        ['Ruta 9 Automotores', 'Córdoba', 'Córdoba'],
        ['Ruta 8 Usados', 'Pilar', 'Buenos Aires'],
        ['Puerto Madero Cars', 'CABA', 'Ciudad Autónoma de Buenos Aires'],
        ['Cuyo Premium Autos', 'San Juan', 'San Juan'],
        ['Litoral Usados Selectos', 'Rosario', 'Santa Fe'],
        ['Sierras Automotores', 'Villa Carlos Paz', 'Córdoba'],
    ];

    /** @var list<string> */
    public const STREETS = [
        'Av. San Martín', 'Av. Belgrano', 'Av. Rivadavia', 'Bv. Oroño', 'Av. Colón',
        'Ruta 9 km', 'Av. Libertador', 'Av. 9 de Julio', 'Calle Sarmiento', 'Av. Mitre',
    ];

    /** @var list<string> */
    public const DESCRIPTIONS = [
        'Excelente estado general, service oficial al día. Listo para transferir.',
        'Único dueño, con todos los papeles al día y verificación vigente.',
        'Muy cuidado, interior impecable. Acepto permuta y financiación.',
        'Se entrega con VTV vigente, dos llaves y manual. Consultá por financiación.',
        'Revisado mecánicamente, sin detalles. Ideal para uso diario.',
        'Cubiertas en buen estado y frenos recién cambiados. Permuta a consideración.',
    ];
}
