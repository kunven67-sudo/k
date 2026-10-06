// Loading-screen copy: funny useless tips and Truckee Times headlines (EN/ES).
// Headlines mix fixed Reno color with stories pulled from YOUR save (current life, obituaries).

import { settings } from '../core/settings.js';
import { save } from '../core/save.js';

const lang = () => (settings.get('language') === 'es' ? 'es' : 'en');

// [english, spanish]
export const TIPS = [
  ['The slot machine does not remember you. You remember the slot machine.', 'La tragamonedas no se acuerda de ti. Tú sí te acuerdas de ella.'],
  ['Blowing on dice has been scientifically proven to make them slightly damp.', 'Está científicamente comprobado que soplar los dados los deja un poco húmedos.'],
  ['Carpets in casinos are ugly on purpose. Don’t look down. Look at the machines.', 'Las alfombras de los casinos son feas a propósito. No mires abajo. Mira las máquinas.'],
  ['Pigeons downtown accept bread, fries and emotional support. Mostly bread.', 'Las palomas del centro aceptan pan, papas fritas y apoyo emocional. Sobre todo pan.'],
  ['You can’t pause life. Nobody can. Try a nap instead.', 'No se puede pausar la vida. Nadie puede. Prueba con una siesta.'],
  ['Free drinks are free the way a mousetrap’s cheese is free.', 'Las bebidas gratis son gratis como el queso de la ratonera.'],
  ['The “Biggest Little City in the World” is neither the biggest nor, technically, little.', 'La “Ciudad Pequeña Más Grande del Mundo” no es la más grande ni, técnicamente, pequeña.'],
  ['Eating a whole pizza at 4 AM counts as one of your five a day if it has peppers.', 'Comerse una pizza entera a las 4 AM cuenta como verdura si lleva pimientos.'],
  ['Stepping on a crack in the sidewalk does nothing. We checked. Twice.', 'Pisar las grietas de la acera no hace nada. Lo comprobamos. Dos veces.'],
  ['If the dealer smiles, she’s being polite. If the pit boss smiles, run.', 'Si la crupier sonríe, es cortesía. Si sonríe el jefe de mesa, corre.'],
  ['Your phone battery dies faster when you’re lost. That’s not a feature, it’s Reno.', 'La batería del móvil se gasta más rápido cuando estás perdido. No es una función, es Reno.'],
  ['Shopping carts are not vehicles. Shopping carts are absolutely vehicles.', 'Los carritos del súper no son vehículos. Los carritos del súper son totalmente vehículos.'],
  ['Hangovers last exactly as long as the night was fun, plus four hours.', 'La resaca dura exactamente lo divertida que fue la noche, más cuatro horas.'],
  ['A watched microwave never finishes. A forgotten one finishes immediately.', 'Un microondas vigilado nunca termina. Uno olvidado termina enseguida.'],
  ['The motel ice machine has been “almost fixed” since 1994.', 'La máquina de hielo del motel está “casi arreglada” desde 1994.'],
  ['Lucky socks work best when nobody knows you’re wearing them.', 'Los calcetines de la suerte funcionan mejor si nadie sabe que los llevas.'],
  ['Tumbleweeds have the right of way. Legally? No. Spiritually? Yes.', 'Las plantas rodadoras tienen preferencia. ¿Legalmente? No. ¿Espiritualmente? Sí.'],
  ['Counting cards is not illegal. Counting them out loud is just awkward.', 'Contar cartas no es ilegal. Contarlas en voz alta solo es incómodo.'],
  ['Your landlord knocks at 11 AM. Your landlord always knocks at 11 AM.', 'Tu casero llama a la puerta a las 11 AM. Tu casero siempre llama a las 11 AM.'],
  ['Clocks are rare on casino floors. Your stomach still works, though.', 'En los casinos casi no hay relojes. Tu estómago sigue funcionando, eso sí.'],
  ['Every quarter on the floor was once somebody’s “this is the one.”', 'Cada moneda en el suelo fue alguna vez el “esta es la buena” de alguien.'],
  ['Reno has more pawn shops than regrets. Close race, though.', 'Reno tiene más casas de empeño que arrepentimientos. Por poco.'],
  ['Sleeping in your car is cheaper than a motel and worse for your neck.', 'Dormir en el coche es más barato que un motel y peor para el cuello.'],
  ['The house edge is not a rumor. It is a building. With a parking garage.', 'La ventaja de la casa no es un rumor. Es un edificio. Con estacionamiento.'],
  ['Wearing sunglasses indoors improves your poker face by 0%.', 'Llevar gafas de sol bajo techo mejora tu cara de póquer en un 0%.'],
  ['Feeding a pigeon once means feeding all pigeons forever.', 'Darle de comer a una paloma una vez es darle de comer a todas para siempre.'],
  ['“Hot” machines are just machines that are warm.', 'Las máquinas “calientes” solo son máquinas tibias.'],
  ['Showering is optional. People noticing is not.', 'Ducharse es opcional. Que la gente lo note, no.'],
  ['The buffet is all-you-can-eat. Your body has a different opinion.', 'El bufé es libre. Tu cuerpo opina distinto.'],
  ['If you hear sirens, it’s probably not about you. Probably.', 'Si oyes sirenas, probablemente no es por ti. Probablemente.'],
  ['A Monday in Reno is just a Sunday with more coffee.', 'Un lunes en Reno es solo un domingo con más café.'],
  ['Rubbing a stranger’s bald head for luck is a great way to meet security.', 'Frotarle la calva a un desconocido para tener suerte es una gran forma de conocer a seguridad.'],
  ['Every slot machine says “WINNER” in the same font as “INSERT MORE”.', 'Toda tragamonedas escribe “GANADOR” con la misma letra que “INSERTE MÁS”.'],
  ['The river downtown is called the Truckee. It does not care how your night went.', 'El río del centro se llama Truckee. Le da igual cómo te fue la noche.'],
];

export function randomTip(rng = Math.random) {
  const tip = TIPS[Math.floor(rng() * TIPS.length)];
  return lang() === 'es' ? tip[1] : tip[0];
}

// Local color. Each: [headline EN, headline ES, deck EN, deck ES]
const LOCAL = [
  ['Man Wins $40 at Slots, Spends $60 Celebrating', 'Hombre gana $40 en tragamonedas y gasta $60 celebrándolo', 'Friends describe the evening as “a net positive, emotionally.”', 'Sus amigos describen la noche como “positiva en lo emocional”.'],
  ['Pigeon Population Downtown Reaches “Concerning”', 'Las palomas del centro alcanzan un nivel “preocupante”', 'City council blames french fries; french fries decline to comment.', 'El ayuntamiento culpa a las papas fritas; las papas no hacen comentarios.'],
  ['Wind Relocates Tumbleweed, Three Trash Cans and One Lawn Chair', 'El viento traslada una planta rodadora, tres basureros y una silla', 'Lawn chair last seen heading toward Sparks at “a good clip.”', 'La silla fue vista por última vez rumbo a Sparks “a buen ritmo”.'],
  ['Local Motel Ice Machine Works for Eleven Minutes', 'La máquina de hielo de un motel funciona once minutos', 'Guests describe the moment as “honestly beautiful.”', 'Los huéspedes describen el momento como “sinceramente precioso”.'],
  ['Arch Lights Burn Brighter Than Ever, Says Arch', 'El Arco brilla más que nunca, según el Arco', 'Virginia Street neon inspected; found “extremely on.”', 'El neón de Virginia Street, inspeccionado: “muy encendido”.'],
  ['Shopping Cart Found Atop Parking Garage, Nobody Knows How', 'Hallan un carrito en lo alto de un estacionamiento; nadie sabe cómo', 'Police have “several theories, all of them bad.”', 'La policía tiene “varias teorías, todas malas”.'],
  ['Retiree Hits Second Jackpot, Asks for Quieter Bells', 'Jubilada gana su segundo premio gordo y pide campanas más bajitas', '“The first one was louder,” she told reporters.', '“El primero sonó más fuerte”, dijo a la prensa.'],
  ['Buffet Shrimp Supply “Holding,” Say Officials', 'Las gambas del bufé “aguantan”, según las autoridades', 'Officials did not define “holding.”', 'No definieron “aguantan”.'],
];

function lifeStories() {
  const out = [];
  try {
    const obits = save.obituaries();
    for (const o of obits.slice(0, 3)) {
      const name = o.character?.name || o.character?.firstName || 'Local Resident';
      const cause = o.cause || o.causeOfDeath;
      out.push([
        `${name} Remembered by Few, Missed by Fewer`,
        `${name}: recordado por pocos, extrañado por menos`,
        cause ? `Cause of death: ${cause}.` : 'The family asks for privacy and loose change.',
        cause ? `Causa de muerte: ${cause}.` : 'La familia pide privacidad y monedas sueltas.',
      ]);
    }
    const life = save.life || (save.hasLife() ? JSON.parse(localStorage.getItem('gamble.life.v1') || 'null') : null);
    const name = life?.character?.name || life?.character?.firstName;
    if (name) {
      out.push([
        `${name} Spotted Downtown, Looking “Like a Person With Plans”`,
        `Ven a ${name} por el centro, con “cara de tener planes”`,
        'Witnesses could not confirm whether the plans were good.',
        'Los testigos no pudieron confirmar si los planes eran buenos.',
      ]);
    }
  } catch {
    /* corrupted save data never breaks a loading screen */
  }
  return out;
}

/** Returns {lead, side:[...]} in the current language. Each item {head, deck}. */
export function headlines(rng = Math.random) {
  const pool = [...lifeStories(), ...LOCAL];
  // Life stories lead when they exist; the rest are shuffled.
  const own = pool.length - LOCAL.length;
  const rest = pool.slice(own);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  const ordered = [...pool.slice(0, own), ...rest];
  const es = lang() === 'es';
  const pick = (h) => ({ head: es ? h[1] : h[0], deck: es ? h[3] : h[2] });
  return { lead: pick(ordered[0]), side: ordered.slice(1, 4).map(pick) };
}
