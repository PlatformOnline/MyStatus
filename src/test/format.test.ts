import * as assert from 'assert';
import { expiryDate } from '../commands/setStatus';
import { statusEmoji, statusText } from '../util/format';

suite('format', () => {
  test('extracts unicode emoji from emojiHTML', () => {
    const s = {
      emoji: ':palm_tree:',
      emojiHTML: '<div><g-emoji class="g-emoji" alias="palm_tree">🌴</g-emoji></div>',
    };
    assert.strictEqual(statusEmoji(s), '🌴');
  });

  test('extracts emoji from plain <div> html (actual API shape)', () => {
    assert.strictEqual(statusEmoji({ emoji: ':computer:', emojiHTML: '<div>💻</div>' }), '💻');
    assert.strictEqual(statusEmoji({ emoji: ':computer:', emojiHTML: '<div>&#x1f4bb;</div>' }), '💻');
  });

  test('falls back to shortcode for custom emoji', () => {
    assert.strictEqual(statusEmoji({ emoji: ':octocat:', emojiHTML: '<div><img src="x"></div>' }), ':octocat:');
  });

  test('statusText joins emoji and message', () => {
    assert.strictEqual(
      statusText({
        emoji: ':dart:',
        emojiHTML: '<g-emoji>🎯</g-emoji>',
        message: 'Focusing',
        indicatesLimitedAvailability: true,
        expiresAt: null,
      }),
      '🎯 Focusing',
    );
    assert.strictEqual(statusText(null), '');
  });

  test('expiryDate "week" lands on Sunday', () => {
    const wed = new Date(2026, 10, 18, 10, 0); // Wednesday
    const d = new Date(expiryDate('week', wed)!);
    assert.strictEqual(d.getDay(), 0);
    assert.strictEqual(expiryDate('never', wed), undefined);
  });
});
