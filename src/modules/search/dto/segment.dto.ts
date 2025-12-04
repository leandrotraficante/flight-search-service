// DTO que representa un segmento de vuelo normalizado dentro del dominio de búsqueda
// Un segmento es un tramo individual de vuelo (por ejemplo: JFK -> LAX)
export interface SegmentDto {
  // Información de salida del segmento
  departure: {
    // Código IATA del aeropuerto de salida (3 letras, ej: "JFK")
    airport: string;
    // Fecha y hora de salida en formato ISO 8601 (ej: "2024-12-25T10:30:00Z")
    time: string;
    // Terminal de salida (opcional, ej: "5")
    terminal?: string;
  };

  // Información de llegada del segmento
  arrival: {
    // Código IATA del aeropuerto de llegada (3 letras, ej: "LAX")
    airport: string;
    // Fecha y hora de llegada en formato ISO 8601
    time: string;
    // Terminal de llegada (opcional)
    terminal?: string;
  };

  // Duración del segmento en minutos (ya normalizada desde el formato original del proveedor)
  durationMinutes: number;

  // Código IATA de la aerolínea que opera este segmento (2 letras, ej: "AA")
  airline: string;

  // Número de vuelo completo (ej: "AA1234")
  flightNumber: string;
}
