// Renders Kirka global chat as a Discord ANSI code block: coloured names, a separator column,
// and skin names tinted by rarity. Text only, no canvas.

// Discord only paints these eight foreground colours inside an ```ansi block.
const A = {
  reset: '[0m',
  grey: '[0;30m',
  red: '[0;31m',
  green: '[0;32m',
  yellow: '[0;33m',
  blue: '[0;34m',
  pink: '[0;35m',
  cyan: '[0;36m',
  white: '[0;37m',
};

const RARITY_COLOUR = {
  MYTHICAL: A.red,
  LEGENDARY: A.yellow,
  EPIC: A.pink,
  RARE: A.blue,
  UNCOMMON: A.green,
  COMMON: A.grey,
};

// Kirka's own role colours, mapped onto the closest ansi colour available
const ROLE_COLOUR = {
  BOT: A.red,
  MODERATOR: A.blue,
  VERIFIED: A.blue,
  ADMIN: A.green,
  OWNER: A.white,
  SCRIPT: A.pink,
  ASSET: A.yellow,
  PAYMENT: A.red,
  MAP: A.blue,
  BUG: A.green,
  USER: A.cyan,
};

const NAME_COL = 20;     // characters reserved for "[level] name" so every separator lines up
const MSG_MAX = 88;      // trim long trade lists instead of letting them wrap badly

const BAD_WORDS = [
  'nigger', 'nigga', 'faggot', 'fag', 'retard', 'cunt', 'whore', 'slut', 'rape',
  'kys', 'kill yourself', 'bitch', 'pussy', 'dick', 'cock', 'fuck', 'shit', 'asshole',
];
const BAD_RE = new RegExp(`\\b(${BAD_WORDS.join('|')})\\b`, 'gi');

/** Replace slurs and swearing with asterisks, keeping the first letter. */
export function cleanMessage(text) {
  return text.replace(BAD_RE, (w) => w[0] + '*'.repeat(Math.max(1, w.length - 1)));
}

const pad = (s, n) => (s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length));

/**
 * Kirka wraps item names in tags. Two shapes appear in live chat:
 *   [Crispy||BODY_SKIN|MYTHICAL]        and   [Or|Bayonet|WEAPON_SKIN|MYTHICAL]
 * Both end with the rarity, so take the first field as the name and the last as the rarity.
 */
function colourItems(text) {
  return text.replace(/\[([^\]|]+)\|([^\]]*)\]/g, (whole, name, rest) => {
    const rarity = String(rest).split('|').filter(Boolean).pop() || '';
    const colour = RARITY_COLOUR[rarity.toUpperCase()];
    return colour ? `${colour}${name}${A.white}` : name;
  });
}

function messageBody(raw) {
  const text = cleanMessage(String(raw).replace(/\*\*/g, '').replace(/\s+/g, ' ').trim());
  // measure length without the tag syntax, so trimming matches what people actually see
  const plain = text.replace(/\[([^\]|]+)\|[^\]]*\]/g, '$1');
  const trimmed = plain.length > MSG_MAX ? text.slice(0, text.length - (plain.length - MSG_MAX)) + '…' : text;
  return colourItems(trimmed);
}

/**
 * Build the ```ansi block for a list of buffered chat rows.
 * Rows come from getRecentChat() in chatListener.js.
 */
/**
 * Spam is most of Kirka chat: the same line over and over, or a single character repeated.
 * Collapse consecutive repeats from the same person into one line with a counter, and drop
 * anything with no readable text left after cleaning.
 */
function collapse(rows) {
  const out = [];
  for (const m of rows) {
    const body = cleanMessage(String(m.message).replace(/\*\*/g, '').trim());
    if (!body.replace(/[\s*]/g, '')) continue;
    const prev = out[out.length - 1];
    if (prev && prev.name === m.name && prev.type === m.type && String(prev.message).trim() === String(m.message).trim()) {
      prev.repeat = (prev.repeat || 1) + 1;
      continue;
    }
    out.push({ ...m });
  }
  return out;
}

export function buildChatBlock(rawRows) {
  const rows = collapse(rawRows);
  if (!rows.length) return '```ansi\n' + A.grey + 'Nothing in chat yet — the listener just started.' + A.reset + '\n```';

  const lines = rows.map((m) => {
    if (m.type === 13) {
      return `${A.yellow}${pad('SERVER', NAME_COL)}${A.grey}│ ${A.white}${messageBody(m.message)}${A.reset}`;
    }
    const level = m.level == null ? '' : `[${m.level}] `;
    const who = pad(`${level}${m.name || '?'}`, NAME_COL);
    const nameColour = ROLE_COLOUR[m.role] || A.cyan;
    // keep the level grey and the name in its role colour
    const head = level
      ? `${A.grey}${who.slice(0, level.length)}${nameColour}${who.slice(level.length)}`
      : `${nameColour}${who}`;
    const repeat = m.repeat > 1 ? ` ${A.grey}(x${m.repeat})` : '';
    return `${head}${A.grey}│ ${A.white}${messageBody(m.message)}${repeat}${A.reset}`;
  });

  let block = '```ansi\n' + lines.join('\n') + '\n```';
  // Discord caps an embed description at 4096 characters; drop the oldest lines if we go over
  while (block.length > 4000 && lines.length > 1) {
    lines.shift();
    block = '```ansi\n' + lines.join('\n') + '\n```';
  }
  return block;
}
