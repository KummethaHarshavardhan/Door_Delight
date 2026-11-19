export const TOTAL_INTRO_DURATION = 40.0;

export const INTRO_SCENES = [
  { id: 1, start: 0, end: 4, title: 'Sunset Awakening' },
  { id: 2, start: 4, end: 7, title: 'Eyes of Wonder' },
  { id: 3, start: 7, end: 12, title: 'The Food Market' },
  { id: 4, start: 12, end: 18, title: 'Wok & Noodles Master' },
  { id: 5, start: 18, end: 24, title: 'Artisan Pizza & Burger' },
  { id: 6, start: 24, end: 30, title: 'Royal Saffron Biryani' },
  { id: 7, start: 30, end: 34, title: 'Sweet & Cold Brew Studio' },
  { id: 8, start: 34, end: 40, title: 'DoorDelight Brand Reveal' },
];

export function getSceneAt(t) {
  const found = INTRO_SCENES.find((s) => t >= s.start && t < s.end);
  return found ? found.id : 8;
}
