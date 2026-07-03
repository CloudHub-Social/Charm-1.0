import { describe, expect, it } from 'vitest';
import { normalizeElementCallUrl } from './CallEmbed';

describe('normalizeElementCallUrl', () => {
  it('prepends https:// to a bare host', () => {
    expect(normalizeElementCallUrl('matrix.cloudhub.social')).toBe(
      'https://matrix.cloudhub.social'
    );
  });

  it('prepends https:// to a bare host with a path', () => {
    expect(normalizeElementCallUrl('call.example.org/embed')).toBe(
      'https://call.example.org/embed'
    );
  });

  it('leaves absolute https URLs untouched', () => {
    expect(normalizeElementCallUrl('https://call.example.org/embed')).toBe(
      'https://call.example.org/embed'
    );
  });

  it('leaves absolute http URLs untouched', () => {
    expect(normalizeElementCallUrl('http://call.example.org/embed')).toBe(
      'http://call.example.org/embed'
    );
  });

  it('leaves root-relative paths untouched', () => {
    expect(normalizeElementCallUrl('/public/custom-call/index.html')).toBe(
      '/public/custom-call/index.html'
    );
  });

  it('leaves protocol-relative URLs untouched', () => {
    expect(normalizeElementCallUrl('//call.example.org/embed')).toBe('//call.example.org/embed');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeElementCallUrl('  matrix.cloudhub.social  ')).toBe(
      'https://matrix.cloudhub.social'
    );
  });
});
