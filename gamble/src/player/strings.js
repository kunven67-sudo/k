// Player-facing text for the player module and the world state (English + Spanish).
import { i18n } from '../core/i18n.js';

i18n.register('player', {
  en: {
    clerkBang: 'Room {n}! Checkout was at eleven! Forty-five bucks or you\'re out!',
    clerkHey: 'Yeah? What do you need?',
    frontDesk: 'Front desk',
    bed: 'Bed',
    loading: 'Waking up…',
  },
  es: {
    clerkBang: '¡Cuarto {n}! ¡La salida era a las once! ¡Cuarenta y cinco dólares o te largas!',
    clerkHey: '¿Sí? ¿Qué necesitas?',
    frontDesk: 'Recepción',
    bed: 'Cama',
    loading: 'Despertando…',
  },
});
