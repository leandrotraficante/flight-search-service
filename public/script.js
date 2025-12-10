const form = document.getElementById('searchForm');
const submitBtn = document.getElementById('submitBtn');
const loadingDiv = document.getElementById('loading');
const errorDiv = document.getElementById('error');
const resultsSection = document.getElementById('results');
const resultsTitle = document.getElementById('resultsTitle');
const resultsList = document.getElementById('resultsList');
const sortSelect = document.getElementById('sortBy');

// Guardar datos originales para re-ordenar sin hacer fetch
let currentFlightData = null;

// Configurar fecha mínima (hoy) para fecha de salida
const departureDateInput = document.getElementById('departureDate');
const returnDateInput = document.getElementById('returnDate');
const today = new Date().toISOString().split('T')[0];
departureDateInput.setAttribute('min', today);

// Actualizar fecha mínima de regreso cuando cambie la fecha de salida
departureDateInput.addEventListener('change', (e) => {
    const departureDate = e.target.value;
    if (departureDate) {
        // La fecha de regreso debe ser al menos un día después de la salida
        const minReturnDate = new Date(departureDate);
        minReturnDate.setDate(minReturnDate.getDate() + 1);
        const minReturnDateStr = minReturnDate.toISOString().split('T')[0];
        returnDateInput.setAttribute('min', minReturnDateStr);
        
        // Si la fecha de regreso es anterior a la nueva fecha mínima, limpiarla
        if (returnDateInput.value && returnDateInput.value <= departureDate) {
            returnDateInput.value = '';
        }
    }
});

// Validar que fecha de regreso sea posterior a fecha de salida
returnDateInput.addEventListener('change', (e) => {
    const returnDate = e.target.value;
    const departureDate = departureDateInput.value;
    
    if (returnDate && departureDate && returnDate <= departureDate) {
        e.target.setCustomValidity('La fecha de regreso debe ser posterior a la fecha de salida');
        e.target.reportValidity();
    } else {
        e.target.setCustomValidity('');
    }
});

// Función helper para convertir a mayúsculas
function convertToUpperCase(e) {
    const input = e.target;
    const cursorPos = input.selectionStart; // Guardar posición del cursor
    input.value = input.value.toUpperCase();
    // Restaurar posición del cursor después de convertir
    input.setSelectionRange(cursorPos, cursorPos);
}

// Convertir códigos a mayúsculas automáticamente (input y blur)
const originInput = document.getElementById('origin');
originInput.addEventListener('input', convertToUpperCase);
originInput.addEventListener('blur', convertToUpperCase);

const destinationInput = document.getElementById('destination');
destinationInput.addEventListener('input', convertToUpperCase);
destinationInput.addEventListener('blur', convertToUpperCase);

// Manejar envío del formulario
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Validar fechas antes de enviar
    const departureDate = departureDateInput.value;
    const returnDate = returnDateInput.value;
    
    // Validar que fecha de salida sea >= hoy
    if (departureDate < today) {
        showError('La fecha de salida no puede ser en el pasado');
        return;
    }
    
    // Validar que fecha de regreso sea posterior a fecha de salida
    if (returnDate && returnDate <= departureDate) {
        showError('La fecha de regreso debe ser posterior a la fecha de salida');
        returnDateInput.focus();
        return;
    }
    
    // Limpiar resultados anteriores
    resultsSection.style.display = 'none';
    errorDiv.style.display = 'none';
    errorDiv.innerHTML = '';
    
    // Deshabilitar botón y mostrar loading
    submitBtn.disabled = true;
    loadingDiv.style.display = 'block';
    
    // Construir query params manualmente para mejor control
    const params = new URLSearchParams();
    
    // Campos requeridos - asegurar mayúsculas antes de enviar
    const originInput = document.getElementById('origin');
    const destinationInput = document.getElementById('destination');
    
    // Convertir a mayúsculas y actualizar el input
    originInput.value = originInput.value.trim().toUpperCase();
    destinationInput.value = destinationInput.value.trim().toUpperCase();
    
    const origin = originInput.value;
    const destination = destinationInput.value;
    const adults = parseInt(document.getElementById('adults').value) || 1;
    
    // Asegurar que las fechas estén en formato YYYY-MM-DD (ISO 8601)
    // El input type="date" siempre devuelve este formato, pero lo validamos por si acaso
    const formattedDepartureDate = departureDate; // Ya está en YYYY-MM-DD
    const formattedReturnDate = returnDate ? returnDate : null; // Ya está en YYYY-MM-DD si existe
    
    // Validar formato de fecha (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(formattedDepartureDate)) {
        showError('Formato de fecha de salida inválido. Debe ser YYYY-MM-DD');
        submitBtn.disabled = false;
        loadingDiv.style.display = 'none';
        return;
    }
    
    if (formattedReturnDate && !dateRegex.test(formattedReturnDate)) {
        showError('Formato de fecha de regreso inválido. Debe ser YYYY-MM-DD');
        submitBtn.disabled = false;
        loadingDiv.style.display = 'none';
        return;
    }
    
    params.append('origin', origin);
    params.append('destination', destination);
    params.append('departureDate', formattedDepartureDate);
    params.append('adults', adults.toString());
    
    // Campos opcionales
    if (formattedReturnDate) {
        params.append('returnDate', formattedReturnDate);
    }
    
    // Debug: mostrar formato de fechas en consola
    console.log('Fechas enviadas:', {
        departureDate: formattedDepartureDate,
        returnDate: formattedReturnDate,
        formato: 'YYYY-MM-DD (ISO 8601)'
    });
    
    const children = parseInt(document.getElementById('children').value) || 0;
    if (children > 0) {
        params.append('children', children.toString());
    }
    
    const travelClass = document.getElementById('travelClass').value;
    if (travelClass) {
        params.append('travelClass', travelClass);
    }
    
    const currency = document.getElementById('currency').value;
    if (currency) {
        params.append('currency', currency);
    }
    
    const includedAirlines = document.getElementById('includedAirlines').value.trim().toUpperCase();
    if (includedAirlines) {
        params.append('includedAirlines', includedAirlines);
    }
    
    const excludedAirlines = document.getElementById('excludedAirlines').value.trim().toUpperCase();
    if (excludedAirlines) {
        params.append('excludedAirlines', excludedAirlines);
    }
    
    // Agregar maxResults por defecto (20) - manejado internamente
    params.append('maxResults', '20');
    
    try {
        const url = `http://localhost:3000/search/flights?${params.toString()}`;
        console.log('Request URL:', url); // Para debugging
        
        const response = await fetch(url);
        const data = await response.json();
        
        loadingDiv.style.display = 'none';
        submitBtn.disabled = false;
        
        if (!response.ok) {
            // Manejar errores de validación
            if (data.errors && Array.isArray(data.errors)) {
                const errorMessages = data.errors.map(err => 
                    `${err.field}: ${err.messages.join(', ')}`
                ).join('\n');
                showError(`Error de validación:\n${errorMessages}`);
            } else if (data.message) {
                showError(data.message);
            } else {
                showError(`Error ${response.status}: ${JSON.stringify(data)}`);
            }
            return;
        }
        
        // Mostrar resultados
        if (data.flights && data.flights.length > 0) {
            displayResults(data);
        } else {
            showNoResults();
        }
    } catch (error) {
        loadingDiv.style.display = 'none';
        submitBtn.disabled = false;
        showError(`Error de conexión: ${error.message}`);
    }
});

function showError(message) {
    errorDiv.innerHTML = `<p>${message.replace(/\n/g, '<br>')}</p>`;
    errorDiv.style.display = 'block';
}

function showNoResults() {
    resultsTitle.textContent = 'No se encontraron vuelos';
    resultsList.innerHTML = '<div class="no-results">No hay vuelos disponibles para esta búsqueda</div>';
    resultsSection.style.display = 'block';
}

function displayResults(data) {
    // Guardar datos originales para poder re-ordenar después
    currentFlightData = data;
    
    // Obtener cantidad de adultos del formulario
    const adults = parseInt(document.getElementById('adults').value) || 1;
    
    resultsTitle.textContent = `Encontrados ${data.count} vuelo${data.count !== 1 ? 's' : ''}`;
    
    // Ordenar y mostrar resultados
    renderSortedResults(data, adults);
    
    resultsSection.style.display = 'block';
}

function renderSortedResults(data, adults) {
    // Obtener criterio de ordenamiento seleccionado
    const sortBy = sortSelect.value || 'price';
    
    // Crear copia del array para ordenar (no modificar el original)
    const sortedFlights = [...data.flights].sort((a, b) => {
        switch(sortBy) {
            case 'price':
                return a.price.amount - b.price.amount;
            case 'duration':
                return a.durationMinutes - b.durationMinutes;
            case 'stops':
                // Escalas = número de segmentos - 1 (vuelo directo tiene 0 escalas)
                return (a.segments.length - 1) - (b.segments.length - 1);
            default:
                return 0;
        }
    });
    
    // Limpiar lista anterior
    resultsList.innerHTML = '';
    
    // Renderizar vuelos ordenados
    sortedFlights.forEach(flight => {
        const flightCard = createFlightCard(flight, adults);
        resultsList.appendChild(flightCard);
    });
}

function createFlightCard(flight, adults) {
    const card = document.createElement('div');
    card.className = 'flight-card';
    
    // Formatear precio
    const price = new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: flight.price.currency || 'USD'
    }).format(flight.price.amount);
    
    // Formatear duración
    const hours = Math.floor(flight.durationMinutes / 60);
    const minutes = flight.durationMinutes % 60;
    const duration = `${hours}h ${minutes}m`;
    
    // Emojis de adultos
    const adultsEmojis = '👤'.repeat(adults);
    
    // Header con precio y aerolíneas
    const header = document.createElement('div');
    header.className = 'flight-header';
    header.innerHTML = `
        <div>
            <div class="flight-price">${price} <span class="flight-adults">${adultsEmojis}</span></div>
            <div class="flight-airlines">Aerolíneas: ${flight.airlines.join(', ')}</div>
            <div class="flight-duration">Duración total: ${duration}</div>
        </div>
    `;
    card.appendChild(header);
    
    // Segmentos
    flight.segments.forEach((segment, index) => {
        const segmentDiv = createSegmentDiv(segment, index, flight.segments.length);
        card.appendChild(segmentDiv);
    });
    
    return card;
}

function createSegmentDiv(segment, index, totalSegments) {
    const div = document.createElement('div');
    div.className = 'segment';
    
    // Formatear fechas
    const departureTime = new Date(segment.departure.time);
    const arrivalTime = new Date(segment.arrival.time);
    
    const formatTime = (date) => {
        return date.toLocaleTimeString('es-ES', { 
            hour: '2-digit', 
            minute: '2-digit',
            timeZone: 'UTC'
        });
    };
    
    const formatDate = (date) => {
        return date.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: 'short'
        });
    };
    
    // Duración del segmento
    const hours = Math.floor(segment.durationMinutes / 60);
    const minutes = segment.durationMinutes % 60;
    const segmentDuration = `${hours}h ${minutes}m`;
    
    div.innerHTML = `
        <div class="segment-header">
            <div class="segment-route">
                ${segment.departure.airport} → ${segment.arrival.airport}
                ${index < totalSegments - 1 ? '<span style="color: #888; font-size: 0.8em;"> (escala)</span>' : ''}
            </div>
            <div class="segment-airline">${segment.airline} ${segment.flightNumber}</div>
        </div>
        <div class="segment-times">
            <div class="segment-time">
                <span class="time">${formatTime(departureTime)}</span>
                <span class="airport">${segment.departure.airport}${segment.departure.terminal ? ` T${segment.departure.terminal}` : ''}</span>
                <span class="airport" style="font-size: 0.8em;">${formatDate(departureTime)}</span>
            </div>
            <div style="text-align: center; color: #888; padding: 0 20px;">
                ${segmentDuration}
            </div>
            <div class="segment-time" style="text-align: right;">
                <span class="time">${formatTime(arrivalTime)}</span>
                <span class="airport">${segment.arrival.airport}${segment.arrival.terminal ? ` T${segment.arrival.terminal}` : ''}</span>
                <span class="airport" style="font-size: 0.8em;">${formatDate(arrivalTime)}</span>
            </div>
        </div>
    `;
    
    return div;
}

// Listener para re-ordenar resultados cuando cambie el selector
if (sortSelect) {
    sortSelect.addEventListener('change', function() {
        if (currentFlightData) {
            const adults = parseInt(document.getElementById('adults').value) || 1;
            renderSortedResults(currentFlightData, adults);
        }
    });
}

