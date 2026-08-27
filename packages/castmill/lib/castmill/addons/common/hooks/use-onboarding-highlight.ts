import { createEffect, onCleanup } from 'solid-js';

/**
 * Hook to handle onboarding highlight functionality.
 * Watches for a `highlight` URL param and applies a pulse animation
 * to the target element specified by the selector.
 *
 * @param params - The search params tuple from useSearchParams [searchParams, setSearchParams]
 */
export function useOnboardingHighlight(
  params:
    | [
        { highlight?: string },
        (params: Record<string, any>, options?: { replace?: boolean }) => void,
      ]
    | undefined
) {
  createEffect(() => {
    if (!params) return;

    const [searchParams, setSearchParams] = params;
    const highlightSelector = searchParams.highlight;

    if (highlightSelector) {
      // Clear the param immediately to prevent re-triggering
      setSearchParams({ highlight: undefined }, { replace: true });

      const decodeSelector = (selector: string) => {
        try {
          return decodeURIComponent(selector);
        } catch {
          return selector;
        }
      };

      const resolvedSelector = decodeSelector(highlightSelector);
      let attemptTimeout: ReturnType<typeof setTimeout> | undefined;
      let removeTimeout: ReturnType<typeof setTimeout> | undefined;
      let attempts = 0;
      const maxAttempts = 20;
      const attemptDelay = 150;

      const tryHighlight = () => {
        const element = document.querySelector(resolvedSelector);
        if (element) {
          // Scroll element into view
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });

          // Add highlight class
          element.classList.add('onboarding-highlight');

          // Remove highlight after animation completes
          removeTimeout = setTimeout(() => {
            element.classList.remove('onboarding-highlight');
          }, 3000);
          return;
        }

        attempts += 1;
        if (attempts < maxAttempts) {
          attemptTimeout = setTimeout(tryHighlight, attemptDelay);
        }
      };

      // Wait briefly for the page to render, then try to highlight
      attemptTimeout = setTimeout(tryHighlight, 300);

      onCleanup(() => {
        if (attemptTimeout) clearTimeout(attemptTimeout);
        if (removeTimeout) clearTimeout(removeTimeout);
      });
    }
  });
}
