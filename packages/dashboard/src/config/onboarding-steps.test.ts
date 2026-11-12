import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ONBOARDING_STEPS } from './onboarding-steps';

const DOCS_BASE_URL = 'https://docs.castmill.io/docs/';
const WEBSITE_DOCS_DIR = resolve(__dirname, '../../../website/docs');

describe('ONBOARDING_STEPS documentation links', () => {
  const stepsWithDocs = ONBOARDING_STEPS.filter((step) => step.docsUrl);

  it('has documentation links', () => {
    expect(stepsWithDocs.length).toBeGreaterThan(0);
  });

  it.each(stepsWithDocs.map((step) => [step.id, step.docsUrl!]))(
    'links %s to an existing documentation page',
    (_id, docsUrl) => {
      expect(docsUrl.startsWith(DOCS_BASE_URL)).toBe(true);

      const docPath = docsUrl.slice(DOCS_BASE_URL.length);
      const candidates = ['.md', '.mdx'].map((ext) =>
        resolve(WEBSITE_DOCS_DIR, `${docPath}${ext}`)
      );

      expect(candidates.some((candidate) => existsSync(candidate))).toBe(true);
    }
  );
});
