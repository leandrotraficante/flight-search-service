// Importamos los DTOs relacionados que ya definimos
import { PriceDto } from './price.dto';
import { SegmentDto } from './segment.dto';

// DTO que representa un vuelo completo normalizado en el dominio de búsqueda
// Este DTO es independiente del proveedor y puede venir de Amadeus, Skyscanner, etc.
export interface FlightDto {
  // ID único del vuelo proporcionado por el proveedor externo
  // Este ID puede usarse para reservar o obtener más detalles del vuelo
  id: string;

  // Precio total del vuelo normalizado
  // Usa PriceDto que ya definimos (amount + currency)
  price: PriceDto;

  // Array de segmentos que componen este vuelo
  // Un vuelo directo tiene 1 segmento, un vuelo con escala tiene múltiples segmentos
  // Ejemplo: [JFK->LAX] = 1 segmento, [JFK->MIA->LAX] = 2 segmentos
  segments: SegmentDto[];

  // Duración total del vuelo en minutos
  // Es la suma de la duración de todos los segmentos más los tiempos de espera en escalas
  durationMinutes: number;

  // Array de códigos IATA únicos de las aerolíneas involucradas en este vuelo
  // Ejemplo: ["AA"] para un vuelo directo de American Airlines
  // Ejemplo: ["AA", "DL"] para un vuelo con cambio de aerolínea (American Airlines + Delta)
  airlines: string[];

  // Identificador del proveedor que proporcionó esta oferta
  // Permite saber de dónde viene la oferta cuando hay múltiples proveedores integrados
  // Ejemplos: "amadeus", "skyscanner", "kayak"
  provider: string;
}
