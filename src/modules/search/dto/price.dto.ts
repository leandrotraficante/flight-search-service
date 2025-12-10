// DTO de precio normalizado usado en el dominio de búsqueda de vuelos
// Este DTO es independiente del proveedor (Amadeus, etc.) y representa un precio simple
export interface PriceDto {
  // Monto numérico del precio (ej: 500.00)
  amount: number;

  // Moneda del precio en formato ISO 4217 (3 letras, ej: "USD", "EUR")
  currency: string;
}
