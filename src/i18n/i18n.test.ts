import { describe, expect, it } from 'vitest';
import { translate, translateList } from './index';
import { lt } from './lt';
import { en } from './en';

describe('i18n', () => {
  it('translates Lithuanian by default keys', () => {
    expect(translate('lt', 'home.fedButton')).toBe('Pamaitinta');
    expect(translate('en', 'home.fedButton')).toBe('Fed');
  });

  it('falls back to Lithuanian for unknown language values', () => {
    expect(translate('en', 'appName')).toBe('Frėja');
  });

  it('returns the key path for completely missing keys', () => {
    expect(translate('lt', 'no.such.key')).toBe('no.such.key');
  });

  it('list translation works', () => {
    expect(translateList('lt', 'settings.dayNamesShort')).toHaveLength(7);
    expect(translateList('en', 'settings.dayNamesShort')).toHaveLength(7);
  });

  it('uses proper Lithuanian characters', () => {
    expect(lt.appName).toContain('ė');
    expect(lt.nav.care).toBe('Priežiūra');
  });

  it('en bundle mirrors lt structure at top level', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(lt).sort());
  });
});
