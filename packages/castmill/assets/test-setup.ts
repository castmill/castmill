import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock the IconWrapper component
vi.mock('@castmill/ui-common', async () => {
  const actual: any = await vi.importActual('@castmill/ui-common');
  return {
    ...actual,
    IconWrapper: (props: any) => {
      const iconName = props.icon?.name || 'UnknownIcon';
      // Use actual SolidJS createElement for proper DOM rendering
      const h =
        (actual as any).h ||
        ((tag: string, attrs: any, children?: any) => {
          const el = document.createElement(tag);
          if (attrs) {
            Object.keys(attrs).forEach((key) => {
              if (key.startsWith('data-')) {
                el.setAttribute(key, attrs[key]);
              }
            });
          }
          if (children) {
            if (typeof children === 'string') {
              el.textContent = children;
            } else if (Array.isArray(children)) {
              children.forEach((child) => el.appendChild(child));
            } else {
              el.appendChild(children);
            }
          }
          return el;
        });

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('data-icon', iconName);

      return h('div', { 'data-testid': 'icon-wrapper' }, svg);
    },
    useToast: () => ({
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warning: vi.fn(),
    }),
  };
});
