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
// Importamos decoradores de transformación de class-transformer
// Estos decoradores transforman los tipos de datos (ej: string a number) desde query params
import { Type } from 'class-transformer';

// DTO para el request de búsqueda de vuelos desde la API pública
// Este DTO define y valida los parámetros que recibe el endpoint de búsqueda
// Los nombres son más amigables que los de Amadeus (origin en lugar de originLocationCode)
export class SearchFlightsRequestDto {
  // Código IATA del aeropuerto de origen (3 letras, ej: "JFK", "LAX", "MAD")
  // Este campo es requerido y debe ser exactamente 3 caracteres
  @IsString({ message: 'origin debe ser un string' })
  @IsNotEmpty({ message: 'origin es requerido' })
  @Length(3, 3, { message: 'origin debe tener exactamente 3 caracteres (código IATA)' })
  origin!: string;

  // Código IATA del aeropuerto de destino (3 letras)
  // Este campo es requerido y debe ser exactamente 3 caracteres
  @IsString({ message: 'destination debe ser un string' })
  @IsNotEmpty({ message: 'destination es requerido' })
  @Length(3, 3, { message: 'destination debe tener exactamente 3 caracteres (código IATA)' })
  destination!: string;

  // Fecha de salida en formato ISO 8601 (YYYY-MM-DD)
  // Ejemplo: "2024-12-25"
  // Este campo es requerido y debe ser una fecha válida
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

  // Número de adultos (mínimo 1, máximo 9)
  // Este campo es requerido y debe ser un número entero positivo
  // @Type(() => Number) transforma el string del query param a número
  @Type(() => Number)
  @IsInt({ message: 'adults debe ser un número entero' })
  @Min(1, { message: 'adults debe ser al menos 1' })
  @Max(9, { message: 'adults no puede ser mayor a 9' })
  adults!: number;

  // Número de niños (opcional, 0 o más)
  // Si no se proporciona, se asume 0
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'children debe ser un número entero' })
  @Min(0, { message: 'children no puede ser negativo' })
  @Max(9, { message: 'children no puede ser mayor a 9' })
  children?: number;

  // Número de infantes (opcional, 0 o más)
  // Si no se proporciona, se asume 0
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'infants debe ser un número entero' })
  @Min(0, { message: 'infants no puede ser negativo' })
  @Max(9, { message: 'infants no puede ser mayor a 9' })
  infants?: number;

  // Número máximo de resultados a retornar (opcional, default varía según el proveedor)
  // Si no se proporciona, se usa un valor por defecto
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'maxResults debe ser un número entero' })
  @Min(1, { message: 'maxResults debe ser al menos 1' })
  @Max(250, { message: 'maxResults no puede ser mayor a 250' })
  maxResults?: number;

  // Clase de viaje (opcional: "ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST")
  // Si no se proporciona, se buscan todas las clases disponibles
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
  @IsArray({ message: 'includedAirlines debe ser un array' })
  @IsString({ each: true, message: 'Cada código de aerolínea debe ser un string' })
  @Length(2, 2, {
    each: true,
    message: 'Cada código de aerolínea debe tener exactamente 2 caracteres',
  })
  includedAirlines?: string[];

  // Códigos de aerolíneas a excluir (opcional, array de códigos IATA de 2 letras)
  // Si se proporciona, se excluyen vuelos de estas aerolíneas
  @IsOptional()
  @IsArray({ message: 'excludedAirlines debe ser un array' })
  @IsString({ each: true, message: 'Cada código de aerolínea debe ser un string' })
  @Length(2, 2, {
    each: true,
    message: 'Cada código de aerolínea debe tener exactamente 2 caracteres',
  })
  excludedAirlines?: string[];

  // Moneda para los precios (opcional, código ISO 4217 de 3 letras, ej: "USD", "EUR")
  // Si no se especifica, se usa una moneda por defecto según el proveedor
  @IsOptional()
  @IsString({ message: 'currency debe ser un string' })
  @Length(3, 3, { message: 'currency debe tener exactamente 3 caracteres (código ISO 4217)' })
  currency?: string;
}
