// Daily art quote engine. Returns a stable quote for the current
// calendar day so every visitor on the same date sees the same one.

const QUOTES = [
  { text: 'Art is never finished, only abandoned.', author: 'Da Vinci' },
  { text: 'Every artist was first an amateur.', author: 'Emerson' },
  { text: 'Creativity takes courage.', author: 'Matisse' },
  { text: 'The purpose of art is washing the dust of daily life off our souls.', author: 'Picasso' },
  { text: 'I dream my painting and I paint my dream.', author: 'Van Gogh' },
  { text: 'Art should comfort the disturbed and disturb the comfortable.', author: 'Banksy' },
  { text: 'Color is a power which directly influences the soul.', author: 'Kandinsky' },
  { text: 'There are no rules. That is how art is born.', author: 'Frankenthaler' },
  { text: 'Art does not reproduce what is visible; it makes things visible.', author: 'Klee' },
  { text: 'Great art picks up where nature ends.', author: 'Chagall' },
  { text: 'I would rather die of passion than of boredom.', author: 'Van Gogh' },
  { text: 'The chief enemy of creativity is good sense.', author: 'Picasso' },
  { text: 'Painting is poetry that is seen rather than felt.', author: 'Da Vinci' },
  { text: 'Every child is an artist.', author: 'Picasso' },
  { text: 'Art enables us to find ourselves and lose ourselves at the same time.', author: 'Merton' },
  { text: 'Without art, the crudeness of reality would make the world unbearable.', author: 'Shaw' },
  { text: 'The artist sees what others only catch a glimpse of.', author: 'Da Vinci' },
  { text: 'A line is a dot that went for a walk.', author: 'Klee' },
  { text: 'Art is the lie that enables us to realize the truth.', author: 'Picasso' },
  { text: 'If you hear a voice within you say "you cannot paint", then by all means paint, and that voice will be silenced.', author: 'Van Gogh' },
];

const dayOfYear = (date = new Date()) => {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start;
  return Math.floor(diff / 86400000); // ms in a day
};

export const getQuoteOfTheDay = (date = new Date()) => {
  const idx = dayOfYear(date) % QUOTES.length;
  return QUOTES[idx];
};

export default getQuoteOfTheDay;
