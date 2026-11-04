import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_PROMPT } from '../constants/systemPrompt.js';
import { parseCarousel } from './parseCarousel.js';

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 4000;

function buildUserMessage(mode, brief) {
  if (mode === 'quick') {
    return `Brief: ${brief.topic}. Build the full carousel.`;
  }
  return [
    `Topic: ${brief.topic}`,
    brief.pillar ? `Pillar: ${brief.pillar}` : '',
    brief.hook ? `Hook: ${brief.hook}` : '',
    brief.slideNotes ? `Slide notes: ${brief.slideNotes}` : '',
    brief.ctaKeyword ? `CTA keyword: ${brief.ctaKeyword}` : '',
    brief.visualDirection ? `Visual direction: ${brief.visualDirection}` : '',
  ].filter(Boolean).join('\n');
}

export async function generateCarousel({ mode, brief, onStream, signal }) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('VITE_ANTHROPIC_API_KEY is not set in your .env file.');

  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  });

  const userMessage = buildUserMessage(mode, brief);
  let fullText = '';

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  for await (const event of stream) {
    if (signal?.aborted) {
      stream.abort();
      throw new Error('Cancelled');
    }
    if (
      event.type === 'content_block_delta' &&
      event.delta?.type === 'text_delta'
    ) {
      fullText += event.delta.text;
      onStream?.(fullText);
    }
  }

  return parseCarousel(fullText);
}
