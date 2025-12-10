// Importamos decoradores de validación de class-validator
// Estos decoradores validan los datos de entrada antes de procesarlos
import {
  IsString,
  IsNotEmpty,
  Length,
  IsDateString,
  IsInt,
  Min,
  Max,
  IsOptional,
  IsArray,
  IsIn,
} from 'class-validator';

// DTO para el request de búsqueda de ofertas de vuelos a la API de Amadeus
// Este DTO define y valida los parámetros que se envían al endpoint /v2/shopping/flight-offers
export class AmadeusFlightOffersRequestDto {
  // Código IATA del aeropuerto de origen (3 letras, ej: "JFK", "LAX", "MAD")
  @IsString({ message: 'originLocationCode debe ser un string' })
  @IsNotEmpty({ message: 'originLocationCode es requerido' })
  @Length(3, 3, { message: 'originLocationCode debe tener exactamente 3 caracteres' })
  originLocationCode!: string;

  // Código IATA del aeropuerto de destino (3 letras)
  @IsString({ message: 'destinationLocationCode debe ser un string' })
  @IsNotEmpty({ message: 'destinationLocationCode es requerido' })
  @Length(3, 3, { message: 'destinationLocationCode debe tener exactamente 3 caracteres' })
  destinationLocationCode!: string;

  // Fecha de salida en formato ISO 8601 (YYYY-MM-DD)
  // Ejemplo: "2024-12-25"
  @IsString({ message: 'departureDate debe ser un string' })
  @IsNotEmpty({ message: 'departureDate es requerido' })
  @IsDateString({}, { message: 'departureDate debe ser una fecha válida en formato YYYY-MM-DD' })
  departureDate!: string;

  // Fecha de retorno en formato ISO 8601 (opcional, solo para vuelos de ida y vuelta)
  // Debe ser posterior a departureDate
  // Si no se proporciona, se busca solo vuelos de ida
  @IsOptional()
  @IsString({ message: 'returnDate debe ser un string' })
  @IsDateString({}, { message: 'returnDate debe ser una fecha válida en formato YYYY-MM-DD' })
  returnDate?: string;

  // Número de adultos (mínimo 1, máximo varía según el plan de Amadeus, típicamente 9)
  @IsInt({ message: 'adults debe ser un número entero' })
  @Min(1, { message: 'adults debe ser al menos 1' })
  @Max(9, { message: 'adults no puede ser mayor a 9' })
  adults!: number;

  // Número de niños (opcional, 0 o más)
  // Si no se proporciona, se asume 0
  @IsOptional()
  @IsInt({ message: 'children debe ser un número entero' })
  @Min(0, { message: 'children no puede ser negativo' })
  @Max(9, { message: 'children no puede ser mayor a 9' })
  children?: number;

  // Número de infantes (opcional, 0 o más)
  // Si no se proporciona, se asume 0
  @IsOptional()
  @IsInt({ message: 'infants debe ser un número entero' })
  @Min(0, { message: 'infants no puede ser negativo' })
  @Max(9, { message: 'infants no puede ser mayor a 9' })
  infants?: number;

  // Número máximo de resultados a retornar (opcional, default varía según Amadeus, máximo típicamente 250)
  // Si no se proporciona, Amadeus retorna un número por defecto
  @IsOptional()
  @IsInt({ message: 'max debe ser un número entero' })
  @Min(1, { message: 'max debe ser al menos 1' })
  @Max(250, { message: 'max no puede ser mayor a 250' })
  max?: number;

  // Clase de viaje (opcional: "ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST")
  // Si no se proporciona, Amadeus busca en todas las clases
  @IsOptional()
  @IsString({ message: 'travelClass debe ser un string' })
  @IsIn(['ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST'], {
    message: 'travelClass debe ser uno de: ECONOMY, PREMIUM_ECONOMY, BUSINESS, FIRST',
  })
  travelClass?: 'ECONOMY' | 'PREMIUM_ECONOMY' | 'BUSINESS' | 'FIRST';

  // Códigos de aerolíneas a incluir (opcional, array de códigos IATA de 2 letras)
  // Ejemplo: ["AA", "DL"] para solo American Airlines y Delta
  // Si se proporciona, solo se retornan vuelos de estas aerolíneas
  @IsOptional()
  @IsArray({ message: 'includedAirlineCodes debe ser un array' })
  @IsString({ each: true, message: 'Cada código de aerolínea debe ser un string' })
  @Length(2, 2, {
    each: true,
    message: 'Cada código de aerolínea debe tener exactamente 2 caracteres',
  })
  includedAirlineCodes?: string[];

  // Códigos de aerolíneas a excluir (opcional, array de códigos IATA de 2 letras)
  // Si se proporciona, se excluyen vuelos de estas aerolíneas
  @IsOptional()
  @IsArray({ message: 'excludedAirlineCodes debe ser un array' })
  @IsString({ each: true, message: 'Cada código de aerolínea debe ser un string' })
  @Length(2, 2, {
    each: true,
    message: 'Cada código de aerolínea debe tener exactamente 2 caracteres',
  })
  excludedAirlineCodes?: string[];

  // Moneda para los precios (opcional, código ISO 4217 de 3 letras, ej: "USD", "EUR")
  // Si no se especifica, Amadeus usa una moneda por defecto según el origen del vuelo
  @IsOptional()
  @IsString({ message: 'currencyCode debe ser un string' })
  @Length(3, 3, { message: 'currencyCode debe tener exactamente 3 caracteres (código ISO 4217)' })
  currencyCode?: string;
}
