// What a food item looks like right now, from its saved state: opened or not, how many came out
// of the multipack, how much is eaten, finished (only the core/peel/empty bottle left).
// Applied to the parts BEFORE the model + physics shapes are built, so collisions always match.
//
// item.state for food: { opened, taken, left (0..1 of the contents left), finished, bites: [[x,y,z]...],
//                        tempC, spoil (0..1+ of shelf life used), ate (bites taken) }

export function foodSpec(spec, state, food) {
  if (!food) return spec;
  const s = state || {};
  const left = s.left ?? 1;
  const parts = spec.parts.map((p) => {
    let q = p;
    const hide = () => { q = { ...q, vis: false, col: false }; };
    if (p.closed && s.opened) hide();
    if (p.opened && !s.opened) hide();
    if (Number.isInteger(p.unit) && food.units && p.unit >= food.units - (s.taken || 0)) hide();
    if (p.leftover && !s.finished) hide();
    if (s.finished && (p.eat || p.liquid)) hide();
    // bite: 'hide' -> pieces vanish in order as you eat
    if (!s.finished && food.bite === 'hide' && Number.isInteger(p.eat)) {
      const n = Math.max(...spec.parts.filter((x) => Number.isInteger(x.eat)).map((x) => x.eat));
      const gone = Math.round((1 - left) * n);
      if (p.eat <= gone) hide();
    }
    // drinks: the liquid shrinks from the bottom up (its collision stays: it's inside the bottle)
    if (!s.finished && p.liquid && left < 1 && q.vis !== false) q = { ...q, levelScale: Math.max(0.02, left) };
    return q;
  });
  // weight goes down as you eat / take things out
  let mass = spec.mass;
  if (food.units && s.taken) mass -= (s.unitMass || 0) * s.taken;
  if (food.netKg) mass -= food.netKg * (1 - left);
  return { ...spec, parts, mass: Math.max(mass, spec.mass * 0.02, 0.002) };
}
