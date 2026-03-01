import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRoot, createSignal } from 'solid-js';
import { useTagFilterEffect } from './useTagFilterEffect';

describe('useTagFilterEffect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('provides handleTagChange function', () => {
    createRoot((dispose) => {
      const [selectedTagIds, setSelectedTagIds] = createSignal<number[]>([]);
      const [tagFilterMode] = createSignal<'any' | 'all'>('any');
      const onRefreshData = vi.fn();
      const onRefreshTree = vi.fn();

      const result = useTagFilterEffect({
        selectedTagIds,
        setSelectedTagIds,
        tagFilterMode,
        onRefreshData,
        onRefreshTree,
      });

      expect(result.handleTagChange).toBeDefined();
      expect(typeof result.handleTagChange).toBe('function');

      dispose();
    });
  });

  it('handleTagChange updates selectedTagIds signal', async () => {
    await new Promise<void>((resolve) => {
      createRoot((dispose) => {
        const [selectedTagIds, setSelectedTagIds] = createSignal<number[]>([]);
        const [tagFilterMode] = createSignal<'any' | 'all'>('any');
        const onRefreshData = vi.fn();
        const onRefreshTree = vi.fn();

        const { handleTagChange } = useTagFilterEffect({
          selectedTagIds,
          setSelectedTagIds,
          tagFilterMode,
          onRefreshData,
          onRefreshTree,
        });

        expect(selectedTagIds()).toEqual([]);

        handleTagChange([1, 2, 3]);

        expect(selectedTagIds()).toEqual([1, 2, 3]);

        dispose();
        resolve();
      });
    });
  });

  it('does not trigger refresh on initial setup (deferred)', async () => {
    await new Promise<void>((resolve) => {
      createRoot((dispose) => {
        const [selectedTagIds, setSelectedTagIds] = createSignal<number[]>([1]);
        const [tagFilterMode] = createSignal<'any' | 'all'>('any');
        const onRefreshData = vi.fn();
        const onRefreshTree = vi.fn();

        useTagFilterEffect({
          selectedTagIds,
          setSelectedTagIds,
          tagFilterMode,
          onRefreshData,
          onRefreshTree,
        });

        // Callbacks should NOT be called on initial setup due to { defer: true }
        expect(onRefreshData).not.toHaveBeenCalled();
        expect(onRefreshTree).not.toHaveBeenCalled();

        dispose();
        resolve();
      });
    });
  });

  it('triggers refresh when selectedTagIds changes', async () => {
    await new Promise<void>((resolve) => {
      createRoot(async (dispose) => {
        const [selectedTagIds, setSelectedTagIds] = createSignal<number[]>([]);
        const [tagFilterMode] = createSignal<'any' | 'all'>('any');
        const onRefreshData = vi.fn();
        const onRefreshTree = vi.fn();

        const { handleTagChange } = useTagFilterEffect({
          selectedTagIds,
          setSelectedTagIds,
          tagFilterMode,
          onRefreshData,
          onRefreshTree,
        });

        // Wait for effects to settle
        await new Promise((r) => setTimeout(r, 10));

        expect(onRefreshData).not.toHaveBeenCalled();
        expect(onRefreshTree).not.toHaveBeenCalled();

        // Change tags
        handleTagChange([1, 2]);

        // Wait for effect to run
        await new Promise((r) => setTimeout(r, 10));

        expect(onRefreshData).toHaveBeenCalledTimes(1);
        expect(onRefreshTree).toHaveBeenCalledTimes(1);

        dispose();
        resolve();
      });
    });
  });

  it('triggers refresh when tagFilterMode changes', async () => {
    await new Promise<void>((resolve) => {
      createRoot(async (dispose) => {
        const [selectedTagIds, setSelectedTagIds] = createSignal<number[]>([
          1, 2,
        ]);
        const [tagFilterMode, setTagFilterMode] = createSignal<'any' | 'all'>(
          'any'
        );
        const onRefreshData = vi.fn();
        const onRefreshTree = vi.fn();

        useTagFilterEffect({
          selectedTagIds,
          setSelectedTagIds,
          tagFilterMode,
          onRefreshData,
          onRefreshTree,
        });

        // Wait for effects to settle
        await new Promise((r) => setTimeout(r, 10));

        expect(onRefreshData).not.toHaveBeenCalled();
        expect(onRefreshTree).not.toHaveBeenCalled();

        // Change filter mode
        setTagFilterMode('all');

        // Wait for effect to run
        await new Promise((r) => setTimeout(r, 10));

        expect(onRefreshData).toHaveBeenCalledTimes(1);
        expect(onRefreshTree).toHaveBeenCalledTimes(1);

        dispose();
        resolve();
      });
    });
  });

  it('triggers refresh when both tags and mode change', async () => {
    await new Promise<void>((resolve) => {
      createRoot(async (dispose) => {
        const [selectedTagIds, setSelectedTagIds] = createSignal<number[]>([]);
        const [tagFilterMode, setTagFilterMode] = createSignal<'any' | 'all'>(
          'any'
        );
        const onRefreshData = vi.fn();
        const onRefreshTree = vi.fn();

        useTagFilterEffect({
          selectedTagIds,
          setSelectedTagIds,
          tagFilterMode,
          onRefreshData,
          onRefreshTree,
        });

        // Wait for effects to settle
        await new Promise((r) => setTimeout(r, 10));

        // Change both at once
        setSelectedTagIds([1, 2]);
        setTagFilterMode('all');

        // Wait for effect to run
        await new Promise((r) => setTimeout(r, 10));

        // Should trigger refresh (both signals tracked in the same effect)
        expect(onRefreshData).toHaveBeenCalled();
        expect(onRefreshTree).toHaveBeenCalled();

        dispose();
        resolve();
      });
    });
  });

  it('triggers refresh multiple times for multiple changes', async () => {
    await new Promise<void>((resolve) => {
      createRoot(async (dispose) => {
        const [selectedTagIds, setSelectedTagIds] = createSignal<number[]>([]);
        const [tagFilterMode, setTagFilterMode] = createSignal<'any' | 'all'>(
          'any'
        );
        const onRefreshData = vi.fn();
        const onRefreshTree = vi.fn();

        const { handleTagChange } = useTagFilterEffect({
          selectedTagIds,
          setSelectedTagIds,
          tagFilterMode,
          onRefreshData,
          onRefreshTree,
        });

        // Wait for effects to settle
        await new Promise((r) => setTimeout(r, 10));

        // First change
        handleTagChange([1]);
        await new Promise((r) => setTimeout(r, 10));

        expect(onRefreshData).toHaveBeenCalledTimes(1);
        expect(onRefreshTree).toHaveBeenCalledTimes(1);

        // Second change
        handleTagChange([1, 2]);
        await new Promise((r) => setTimeout(r, 10));

        expect(onRefreshData).toHaveBeenCalledTimes(2);
        expect(onRefreshTree).toHaveBeenCalledTimes(2);

        // Third change (mode)
        setTagFilterMode('all');
        await new Promise((r) => setTimeout(r, 10));

        expect(onRefreshData).toHaveBeenCalledTimes(3);
        expect(onRefreshTree).toHaveBeenCalledTimes(3);

        dispose();
        resolve();
      });
    });
  });

  it('handleTagChange can clear selection', async () => {
    await new Promise<void>((resolve) => {
      createRoot(async (dispose) => {
        const [selectedTagIds, setSelectedTagIds] = createSignal<number[]>([
          1, 2,
        ]);
        const [tagFilterMode] = createSignal<'any' | 'all'>('any');
        const onRefreshData = vi.fn();
        const onRefreshTree = vi.fn();

        const { handleTagChange } = useTagFilterEffect({
          selectedTagIds,
          setSelectedTagIds,
          tagFilterMode,
          onRefreshData,
          onRefreshTree,
        });

        // Wait for effects to settle
        await new Promise((r) => setTimeout(r, 10));

        expect(selectedTagIds()).toEqual([1, 2]);

        // Clear selection
        handleTagChange([]);

        await new Promise((r) => setTimeout(r, 10));

        expect(selectedTagIds()).toEqual([]);
        expect(onRefreshData).toHaveBeenCalledTimes(1);
        expect(onRefreshTree).toHaveBeenCalledTimes(1);

        dispose();
        resolve();
      });
    });
  });

  it('works with empty initial tag selection', async () => {
    await new Promise<void>((resolve) => {
      createRoot(async (dispose) => {
        const [selectedTagIds, setSelectedTagIds] = createSignal<number[]>([]);
        const [tagFilterMode] = createSignal<'any' | 'all'>('any');
        const onRefreshData = vi.fn();
        const onRefreshTree = vi.fn();

        const { handleTagChange } = useTagFilterEffect({
          selectedTagIds,
          setSelectedTagIds,
          tagFilterMode,
          onRefreshData,
          onRefreshTree,
        });

        await new Promise((r) => setTimeout(r, 10));

        // Add tags
        handleTagChange([5, 10]);

        await new Promise((r) => setTimeout(r, 10));

        expect(selectedTagIds()).toEqual([5, 10]);
        expect(onRefreshData).toHaveBeenCalledTimes(1);
        expect(onRefreshTree).toHaveBeenCalledTimes(1);

        dispose();
        resolve();
      });
    });
  });

  it('handles rapid successive changes correctly', async () => {
    await new Promise<void>((resolve) => {
      createRoot(async (dispose) => {
        const [selectedTagIds, setSelectedTagIds] = createSignal<number[]>([]);
        const [tagFilterMode] = createSignal<'any' | 'all'>('any');
        const onRefreshData = vi.fn();
        const onRefreshTree = vi.fn();

        const { handleTagChange } = useTagFilterEffect({
          selectedTagIds,
          setSelectedTagIds,
          tagFilterMode,
          onRefreshData,
          onRefreshTree,
        });

        await new Promise((r) => setTimeout(r, 10));

        // Rapid changes
        handleTagChange([1]);
        handleTagChange([1, 2]);
        handleTagChange([1, 2, 3]);

        await new Promise((r) => setTimeout(r, 10));

        // Final state should be correct
        expect(selectedTagIds()).toEqual([1, 2, 3]);

        // Each change should trigger refresh
        expect(onRefreshData).toHaveBeenCalled();
        expect(onRefreshTree).toHaveBeenCalled();

        dispose();
        resolve();
      });
    });
  });

  it('effect respects const tuple type for reactive tracking', async () => {
    await new Promise<void>((resolve) => {
      createRoot(async (dispose) => {
        const [selectedTagIds, setSelectedTagIds] = createSignal<number[]>([]);
        const [tagFilterMode, setTagFilterMode] = createSignal<'any' | 'all'>(
          'any'
        );
        const onRefreshData = vi.fn();
        const onRefreshTree = vi.fn();

        useTagFilterEffect({
          selectedTagIds,
          setSelectedTagIds,
          tagFilterMode,
          onRefreshData,
          onRefreshTree,
        });

        await new Promise((r) => setTimeout(r, 10));

        // Change first signal
        setSelectedTagIds([1]);
        await new Promise((r) => setTimeout(r, 10));

        const callCount1 = onRefreshData.mock.calls.length;
        expect(callCount1).toBe(1);

        // Change second signal
        setTagFilterMode('all');
        await new Promise((r) => setTimeout(r, 10));

        const callCount2 = onRefreshData.mock.calls.length;
        expect(callCount2).toBe(2);

        dispose();
        resolve();
      });
    });
  });

  it('calls both refresh callbacks in the correct order', async () => {
    await new Promise<void>((resolve) => {
      createRoot(async (dispose) => {
        const [selectedTagIds, setSelectedTagIds] = createSignal<number[]>([]);
        const [tagFilterMode] = createSignal<'any' | 'all'>('any');
        const callOrder: string[] = [];
        const onRefreshData = vi.fn(() => callOrder.push('data'));
        const onRefreshTree = vi.fn(() => callOrder.push('tree'));

        const { handleTagChange } = useTagFilterEffect({
          selectedTagIds,
          setSelectedTagIds,
          tagFilterMode,
          onRefreshData,
          onRefreshTree,
        });

        await new Promise((r) => setTimeout(r, 10));

        handleTagChange([1]);

        await new Promise((r) => setTimeout(r, 10));

        // Both should be called, data before tree
        expect(callOrder).toEqual(['data', 'tree']);
        expect(onRefreshData).toHaveBeenCalledTimes(1);
        expect(onRefreshTree).toHaveBeenCalledTimes(1);

        dispose();
        resolve();
      });
    });
  });

  it('handles empty tag arrays correctly', async () => {
    await new Promise<void>((resolve) => {
      createRoot(async (dispose) => {
        const [selectedTagIds, setSelectedTagIds] = createSignal<number[]>([
          1, 2,
        ]);
        const [tagFilterMode] = createSignal<'any' | 'all'>('any');
        const onRefreshData = vi.fn();
        const onRefreshTree = vi.fn();

        const { handleTagChange } = useTagFilterEffect({
          selectedTagIds,
          setSelectedTagIds,
          tagFilterMode,
          onRefreshData,
          onRefreshTree,
        });

        await new Promise((r) => setTimeout(r, 10));

        // Clear tags (common operation)
        handleTagChange([]);

        await new Promise((r) => setTimeout(r, 10));

        expect(selectedTagIds()).toEqual([]);
        expect(onRefreshData).toHaveBeenCalledTimes(1);
        expect(onRefreshTree).toHaveBeenCalledTimes(1);

        dispose();
        resolve();
      });
    });
  });

  it('triggers refresh even when tags array has same content (new array instance)', async () => {
    await new Promise<void>((resolve) => {
      createRoot(async (dispose) => {
        const [selectedTagIds, setSelectedTagIds] = createSignal<number[]>([
          1, 2,
        ]);
        const [tagFilterMode] = createSignal<'any' | 'all'>('any');
        const onRefreshData = vi.fn();
        const onRefreshTree = vi.fn();

        const { handleTagChange } = useTagFilterEffect({
          selectedTagIds,
          setSelectedTagIds,
          tagFilterMode,
          onRefreshData,
          onRefreshTree,
        });

        await new Promise((r) => setTimeout(r, 10));

        // Set to same value (but new array instance)
        handleTagChange([1, 2]);

        await new Promise((r) => setTimeout(r, 10));

        // SolidJS triggers effects for new array instances by default
        expect(onRefreshData).toHaveBeenCalledTimes(1);
        expect(onRefreshTree).toHaveBeenCalledTimes(1);

        dispose();
        resolve();
      });
    });
  });

  it('works with different filter modes', async () => {
    await new Promise<void>((resolve) => {
      createRoot(async (dispose) => {
        const [selectedTagIds, setSelectedTagIds] = createSignal<number[]>([]);
        const [tagFilterMode, setTagFilterMode] = createSignal<'any' | 'all'>(
          'all'
        );
        const onRefreshData = vi.fn();
        const onRefreshTree = vi.fn();

        useTagFilterEffect({
          selectedTagIds,
          setSelectedTagIds,
          tagFilterMode,
          onRefreshData,
          onRefreshTree,
        });

        await new Promise((r) => setTimeout(r, 10));

        setTagFilterMode('any');

        await new Promise((r) => setTimeout(r, 10));

        expect(onRefreshData).toHaveBeenCalledTimes(1);
        expect(onRefreshTree).toHaveBeenCalledTimes(1);

        dispose();
        resolve();
      });
    });
  });

  it('continues to work after multiple refresh cycles', async () => {
    await new Promise<void>((resolve) => {
      createRoot(async (dispose) => {
        const [selectedTagIds, setSelectedTagIds] = createSignal<number[]>([]);
        const [tagFilterMode, setTagFilterMode] = createSignal<'any' | 'all'>(
          'any'
        );
        const onRefreshData = vi.fn();
        const onRefreshTree = vi.fn();

        const { handleTagChange } = useTagFilterEffect({
          selectedTagIds,
          setSelectedTagIds,
          tagFilterMode,
          onRefreshData,
          onRefreshTree,
        });

        await new Promise((r) => setTimeout(r, 10));

        // Multiple cycles
        handleTagChange([1]);
        await new Promise((r) => setTimeout(r, 10));

        handleTagChange([1, 2]);
        await new Promise((r) => setTimeout(r, 10));

        setTagFilterMode('all');
        await new Promise((r) => setTimeout(r, 10));

        handleTagChange([2]);
        await new Promise((r) => setTimeout(r, 10));

        expect(onRefreshData).toHaveBeenCalledTimes(4);
        expect(onRefreshTree).toHaveBeenCalledTimes(4);

        dispose();
        resolve();
      });
    });
  });

  it('works with large tag arrays', async () => {
    await new Promise<void>((resolve) => {
      createRoot(async (dispose) => {
        const [selectedTagIds, setSelectedTagIds] = createSignal<number[]>([]);
        const [tagFilterMode] = createSignal<'any' | 'all'>('any');
        const onRefreshData = vi.fn();
        const onRefreshTree = vi.fn();

        const { handleTagChange } = useTagFilterEffect({
          selectedTagIds,
          setSelectedTagIds,
          tagFilterMode,
          onRefreshData,
          onRefreshTree,
        });

        await new Promise((r) => setTimeout(r, 10));

        // Large array
        const largeArray = Array.from({ length: 100 }, (_, i) => i + 1);
        handleTagChange(largeArray);

        await new Promise((r) => setTimeout(r, 10));

        expect(selectedTagIds()).toEqual(largeArray);
        expect(onRefreshData).toHaveBeenCalledTimes(1);
        expect(onRefreshTree).toHaveBeenCalledTimes(1);

        dispose();
        resolve();
      });
    });
  });
});
