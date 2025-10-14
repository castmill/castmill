import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock the IconWrapper component
vi.mock('@castmill/ui-common', async () => {
  const actual = await vi.importActual('@castmill/ui-common');
  return {
    ...actual,
    IconWrapper: ({ icon }: any) => <div data-testid="icon-wrapper">{icon?.name || 'icon'}</div>,
    useToast: () => ({
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warning: vi.fn(),
    }),
  };
});
