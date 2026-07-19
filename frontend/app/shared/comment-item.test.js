import { describe, expect, it } from 'vitest';
import { buildCommentItem, formatCommentMessage } from './comment-item.js';

describe('formatCommentMessage', () => {
  it('formats blockquotes and newlines cleanly', () => {
    const raw = '> @User: Hola\nGracias por responder';
    const formatted = formatCommentMessage(raw);

    expect(formatted).toContain('<blockquote class="comment-quote">@User: Hola</blockquote>');
    expect(formatted).toContain('Gracias por responder');
  });

  it('returns empty string for null or empty input', () => {
    expect(formatCommentMessage('')).toBe('');
    expect(formatCommentMessage(null)).toBe('');
  });
});

describe('buildCommentItem', () => {
  it('renders a comment item with blockquotes and nested replies', () => {
    const comment = {
      id: 10,
      user_id: 5,
      depth: 0,
      message: '> @Admin: saludo\nHola todo bien',
      created_at: new Date().toISOString(),
      user: { first_name: 'Juan', last_name: 'Pérez' },
      replies: [
        {
          id: 11,
          user_id: 6,
          depth: 1,
          message: 'Todo bien!',
          created_at: new Date().toISOString(),
          user: { first_name: 'Maria', last_name: 'Gómez' },
          replies: [],
        },
      ],
    };

    const li = buildCommentItem(comment, { currentUserId: 5, canDelete: true });
    expect(li.querySelector('.comment-quote')).not.toBeNull();
    expect(li.querySelector('.comment-quote').textContent).toBe('@Admin: saludo');
    expect(li.querySelector('.comment-replies')).not.toBeNull();
  });
});
