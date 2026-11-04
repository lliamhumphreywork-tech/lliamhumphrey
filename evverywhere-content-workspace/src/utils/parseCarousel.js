// Strip markdown code fences if Claude wraps the JSON
function stripCodeFence(text) {
  return text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
}

export function parseCarousel(rawText) {
  const cleaned = stripCodeFence(rawText);

  // Find the first { and last } to extract the JSON object
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found in Claude response.');

  const jsonStr = cleaned.slice(start, end + 1);
  const data = JSON.parse(jsonStr);

  if (!data.slides || !Array.isArray(data.slides)) {
    throw new Error('Invalid carousel format — missing slides array.');
  }

  // Normalise each slide
  data.slides = data.slides.map((slide, i) => ({
    number: slide.number || String(i + 1).padStart(2, '0'),
    type: slide.type || 'Slide',
    topBarLabel: slide.topBarLabel || '',
    pill: slide.pill || '',
    headline: slide.headline || '',
    visual: slide.visual || '',
    dek: slide.dek || null,
  }));

  return data;
}

// Parse a headline string like "You're [losing] leads" into segments
export function parseHeadline(headline) {
  const segments = [];
  const regex = /\[([^\]]+)\]/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(headline)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: headline.slice(lastIndex, match.index), accent: false });
    }
    segments.push({ text: match[1], accent: true });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < headline.length) {
    segments.push({ text: headline.slice(lastIndex), accent: false });
  }

  return segments.length ? segments : [{ text: headline, accent: false }];
}
