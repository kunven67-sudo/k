// Random applicant names: a mixed bag that sounds like a real Reno DMV line on a Tuesday.

const FIRST = [
  'Dale', 'Rhonda', 'Marcus', 'Tammy', 'Luis', 'Darlene', 'Wes', 'Priya', 'Hector', 'Jolene',
  'Travis', 'Mei', 'Curtis', 'Lorraine', 'Andre', 'Bobbie', 'Ernesto', 'Crystal', 'Gary', 'Yolanda',
  'Duane', 'Nadia', 'Rusty', 'Gloria', 'Kenji', 'Shelby', 'Ray', 'Imani', 'Vince', 'Rosa',
  'Clint', 'Dolores', 'Tyrell', 'Amber', 'Mateo', 'Peggy', 'Wade', 'Lupe', 'Sonny', 'Cheryl',
  'Abel', 'Trina', 'Floyd', 'Ingrid', 'Jesse', 'Marisol', 'Lyle', 'Nikki', 'Omar', 'Bev',
];
const LAST = [
  'Hollister', 'Ramirez', 'Pruitt', 'Okafor', 'Delgado', 'McCready', 'Nguyen', 'Bauer', 'Castellanos',
  'Whitlock', 'Tanaka', 'Begay', 'Kowalski', 'Lambert', 'Fuentes', 'Odom', 'Sorensen', 'Haddad',
  'Truong', 'Abernathy', 'Vega', 'Pickett', 'Moreno', 'Strand', 'Yazzie', 'Calloway', 'Ibarra',
  'Lindqvist', 'Boone', 'Achebe', 'Sato', 'Gallagher', 'Esparza', 'Duchene', 'Rios', 'Fairbanks',
];

const pick = (a) => a[(Math.random() * a.length) | 0];

/** Returns { first, last } different from `prev` when given. */
export function randomName(prev = null) {
  let n;
  do n = { first: pick(FIRST), last: pick(LAST) };
  while (prev && n.first === prev.first);
  return n;
}
