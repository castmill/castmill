/**
 * ResourceTreeView
 *
 * Displays resources organized as a collapsible tree using tag groups as
 * hierarchical dimensions. Users can select which tag groups form the levels
 * of the tree and swap the order to see different perspectives of the same data.
 *
 * Think of it as: Location > Campaign grid, but generalized to any tag groups.
 */
import {
  Component,
  createSignal,
  createEffect,
  Show,
  For,
  JSX,
  on,
  batch,
} from 'solid-js';
import { createStore } from 'solid-js/store';
import { IoChevronForward, IoChevronDown } from 'solid-icons/io';
import { VsFileMedia } from 'solid-icons/vs';
import { IconWrapper } from '../icon-wrapper';
import { TagBadge } from '../tags/tag-badge';
import { Dropdown } from '../dropdown/dropdown';
import type { Tag, TagGroup } from '../../services/tags.service';
import './resource-tree-view.scss';

// A generic resource item that the tree view can display
export interface TreeResourceItem {
  id: number | string;
  name: string;
  thumbnail?: string;
  [key: string]: any;
}

export interface ResourceTreeViewProps {
  /** Tag groups with preloaded tags (used as tree dimensions) */
  tagGroups: TagGroup[];

  /** All tags (including ungrouped) */
  allTags: Tag[];

  /**
   * Fetch resources matching a set of tag IDs (AND mode).
   * Returns the items and total count.
   */
  fetchResources: (tagIds: number[]) => Promise<{
    data: TreeResourceItem[];
    count: number;
  }>;

  /** Called when a resource is clicked */
  onResourceClick?: (item: TreeResourceItem) => void;

  /** Custom renderer for a resource row */
  renderResource?: (item: TreeResourceItem) => JSX.Element;

  /** Loading text */
  loadingText?: string;

  /** Empty text when no tag groups exist */
  emptyText?: string;

  /** Label for the dimension selector */
  dimensionLabel?: string;

  /** Label for ungrouped/untagged items */
  ungroupedLabel?: string;

  /** Label for untagged items */
  untaggedLabel?: string;

  /** Max resources to show per leaf before showing "show more" */
  maxLeafItems?: number;

  /** Bump this value to force a full tree rebuild (e.g. after editing tags) */
  refreshKey?: number;

  /** When provided, the selected dimension order is persisted in localStorage under this key */
  storageKey?: string;
}

interface TreeNode {
  tag: Tag | null; // null = "Untagged" node
  count: number | null; // null = not yet loaded
  items: TreeResourceItem[];
  expanded: boolean;
  loading: boolean;
  children?: TreeNode[];
}

/** Data stored in the fallback-items signal when a non-leaf node has its
 *  resources loaded directly (sub-dimension tags all had count 0). */
interface FallbackEntry {
  items: TreeResourceItem[];
  count: number;
}

export const ResourceTreeView: Component<ResourceTreeViewProps> = (props) => {
  const maxLeaf = () => props.maxLeafItems ?? 50;

  // Selected dimension order: indices into tagGroups
  const [dimensions, setDimensions] = createSignal<number[]>([]);
  const [treeNodes, setTreeNodes] = createStore<TreeNode[]>([]);
  const [rootLoading, setRootLoading] = createSignal(false);

  // Signal-based map for resources loaded in the "fallback to leaf" path.
  // The SolidJS store doesn't reliably propagate array replacements on nested
  // nodes, so we keep fallback items completely outside the store. The pathKey
  // is the comma-joined index path (e.g. "0", "2,1").
  const [fallbackItems, setFallbackItems] = createSignal<
    Map<string, FallbackEntry>
  >(new Map(), { equals: false });

  // Build counter to cancel stale async builds
  let buildGeneration = 0;

  // Helpers for localStorage persistence
  const persistKey = () =>
    props.storageKey ? `castmill-treeDims-${props.storageKey}` : null;

  const loadPersistedDims = (groupCount: number): number[] | null => {
    const key = persistKey();
    if (!key) return null;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const arr: number[] = JSON.parse(raw);
      // Validate: must be an array of valid group indices with no duplicates
      if (
        !Array.isArray(arr) ||
        arr.length === 0 ||
        arr.some((i) => typeof i !== 'number' || i < 0 || i >= groupCount) ||
        new Set(arr).size !== arr.length
      )
        return null;
      return arr;
    } catch {
      return null;
    }
  };

  // Initialize dimensions when tag groups change
  createEffect(
    on(
      () => props.tagGroups,
      (groups) => {
        if (groups.length > 0) {
          // Restore from localStorage if available, otherwise use default
          const persisted = loadPersistedDims(groups.length);
          if (persisted) {
            setDimensions(persisted);
          } else {
            setDimensions(
              groups.length >= 2 ? [0, 1] : groups.length === 1 ? [0] : []
            );
          }
        } else {
          setDimensions([]);
        }
      }
    )
  );

  // Persist dimensions whenever they change
  createEffect(
    on(dimensions, (dims) => {
      const key = persistKey();
      if (key && dims.length > 0) {
        localStorage.setItem(key, JSON.stringify(dims));
      }
    })
  );

  // Rebuild tree when dimensions, available tags, or refreshKey change
  createEffect(
    on(
      () =>
        [
          dimensions(),
          props.allTags,
          props.tagGroups,
          props.refreshKey ?? 0,
        ] as const,
      ([dims, allTags, groups]) => {
        if (dims.length === 0 || groups.length === 0 || allTags.length === 0) {
          setTreeNodes([]);
          return;
        }
        buildRootLevel(dims);
      }
    )
  );

  const getGroupTags = (groupIndex: number): Tag[] => {
    const group = props.tagGroups[groupIndex];
    if (!group) return [];
    return props.allTags.filter((t) => t.tag_group_id === group.id);
  };

  // Build root level: one node per tag in the first dimension
  const buildRootLevel = async (dims: number[]) => {
    const generation = ++buildGeneration;
    const rootTags = getGroupTags(dims[0]);
    if (rootTags.length === 0) {
      setTreeNodes([]);
      return;
    }

    setRootLoading(true);

    // Build nodes for each tag in root dimension
    const nodes: TreeNode[] = rootTags.map((tag) => ({
      tag,
      count: null,
      items: [],
      expanded: false,
      loading: false,
    }));

    // Fetch counts for all root nodes in parallel
    const countPromises = rootTags.map((tag) =>
      props
        .fetchResources([tag.id])
        .then((r) => r.count)
        .catch((err) => {
          console.error(
            `Failed to fetch count for tag "${tag.name}" (id=${tag.id}):`,
            err
          );
          return 0;
        })
    );

    const counts = await Promise.all(countPromises);

    // Discard results if a newer build started while we were fetching
    if (generation !== buildGeneration) return;

    counts.forEach((count, i) => {
      nodes[i].count = count;
    });

    // Hide tags with zero resources
    const nonEmptyNodes = nodes.filter((n) => n.count !== null && n.count > 0);

    batch(() => {
      setTreeNodes(nonEmptyNodes);
      setFallbackItems(new Map());
      setRootLoading(false);
    });
  };

  // Helper: build a store path array for a node at a given tree path
  // e.g., path=[2,1] → [2, 'children', 1] to address treeNodes[2].children[1]
  const storePath = (path: number[]): (string | number)[] => {
    const result: (string | number)[] = [path[0]];
    for (let i = 1; i < path.length; i++) {
      result.push('children', path[i]);
    }
    return result;
  };

  // Toggle a node's expanded state and load data lazily
  const toggleNode = async (
    path: number[],
    dimLevel: number,
    parentTagIds: number[]
  ) => {
    // Read the current node from the store
    let node: TreeNode | undefined = treeNodes[path[0]];
    for (let i = 1; i < path.length && node; i++) {
      node = node.children?.[path[i]];
    }
    if (!node) return;

    if (node.expanded) {
      // Collapse
      setTreeNodes(...(storePath(path) as [any]), 'expanded', false);
      return;
    }

    // Expand and set loading
    setTreeNodes(...(storePath(path) as [any]), {
      expanded: true,
      loading: true,
    });

    const tagIds = [...parentTagIds, ...(node.tag ? [node.tag.id] : [])];
    const dims = dimensions();
    const nextDimLevel = dimLevel + 1;

    if (nextDimLevel < dims.length) {
      // Build child dimension nodes
      const childTags = getGroupTags(dims[nextDimLevel]);
      const childNodes: TreeNode[] = childTags.map((tag) => ({
        tag,
        count: null,
        items: [],
        expanded: false,
        loading: false,
      }));

      // Fetch counts for children
      const countPromises = childTags.map((tag) =>
        props
          .fetchResources([...tagIds, tag.id])
          .then((r) => r.count)
          .catch((err) => {
            console.error(
              `Failed to fetch count for tag "${tag.name}" (id=${tag.id}):`,
              err
            );
            return 0;
          })
      );

      const counts = await Promise.all(countPromises);
      counts.forEach((count, i) => {
        childNodes[i].count = count;
      });

      // Hide child tags with zero resources
      const nonEmptyChildren = childNodes.filter(
        (n) => n.count !== null && n.count > 0
      );

      if (nonEmptyChildren.length === 0) {
        // No resources match any tag in the child dimension
        // → fall back to leaf mode and load resources directly.
        // Items are stored in a signal (not the store) for reliable reactivity.
        const pathKey = path.join(',');
        try {
          const result = await props.fetchResources(tagIds);
          setFallbackItems((prev) => {
            const next = new Map(prev);
            next.set(pathKey, { items: result.data, count: result.count });
            return next;
          });
          setTreeNodes(...(storePath(path) as [any]), { loading: false });
        } catch (e) {
          console.error('Failed to load resources:', e);
          setFallbackItems((prev) => {
            const next = new Map(prev);
            next.set(pathKey, { items: [], count: 0 });
            return next;
          });
          setTreeNodes(...(storePath(path) as [any]), { loading: false });
        }
      } else {
        setTreeNodes(...(storePath(path) as [any]), {
          children: nonEmptyChildren,
          loading: false,
        });
      }
    } else {
      // Leaf level: load actual resources
      try {
        const result = await props.fetchResources(tagIds);
        setTreeNodes(...(storePath(path) as [any]), {
          items: result.data,
          count: result.count,
          loading: false,
        });
      } catch (e) {
        console.error('Failed to load resources:', e);
        setTreeNodes(...(storePath(path) as [any]), {
          items: [],
          loading: false,
        });
      }
    }
  };

  // Swap two dimensions
  const swapDimension = (fromIndex: number, toIndex: number) => {
    const dims = [...dimensions()];
    [dims[fromIndex], dims[toIndex]] = [dims[toIndex], dims[fromIndex]];
    setDimensions(dims);
  };

  // Set a specific dimension at a level
  const setDimensionAt = (level: number, groupIndex: number) => {
    const dims = [...dimensions()];
    // If this group is already used at another level, swap them
    const existingLevel = dims.indexOf(groupIndex);
    if (existingLevel !== -1 && existingLevel !== level) {
      dims[existingLevel] = dims[level];
    }
    dims[level] = groupIndex;
    setDimensions(dims);
  };

  // Add/remove dimension levels
  const addDimension = () => {
    const dims = dimensions();
    const used = new Set(dims);
    const available = props.tagGroups.findIndex((_, i) => !used.has(i));
    if (available !== -1) {
      setDimensions([...dims, available]);
    }
  };

  const removeDimension = (level: number) => {
    const dims = [...dimensions()];
    dims.splice(level, 1);
    setDimensions(dims);
  };

  // Render a tree node recursively
  const renderNode = (
    node: TreeNode,
    path: number[],
    level: number,
    dimLevel: number,
    parentTagIds: number[]
  ): JSX.Element => {
    const tagIds = [...parentTagIds, ...(node.tag ? [node.tag.id] : [])];
    const isLeaf = dimLevel >= dimensions().length - 1;

    return (
      <div class="tree-node" style={`--depth: ${level}`}>
        <div
          class="tree-node-header"
          classList={{
            expanded: node.expanded,
            leaf: isLeaf && node.expanded,
          }}
          onClick={() => toggleNode(path, dimLevel, parentTagIds)}
        >
          <span class="tree-chevron">
            <Show
              when={node.expanded}
              fallback={<IconWrapper icon={IoChevronForward} />}
            >
              <IconWrapper icon={IoChevronDown} />
            </Show>
          </span>

          <span class="tree-node-info">
            <Show
              when={node.tag}
              fallback={
                <span class="tree-node-label untagged">
                  {props.untaggedLabel || 'Untagged'}
                </span>
              }
            >
              <TagBadge tag={node.tag!} />
            </Show>

            <span class="tree-node-count">
              <Show when={node.count !== null} fallback="…">
                {node.count}
              </Show>
            </span>
          </span>
        </div>

        <Show when={node.expanded}>
          <div class="tree-node-children">
            {/* Child dimension nodes */}
            <Show
              when={
                !isLeaf && !fallbackItems().has(path.join(',')) && node.children
              }
            >
              <For each={node.children}>
                {(child, childIdx) =>
                  renderNode(
                    child,
                    [...path, childIdx()],
                    level + 1,
                    dimLevel + 1,
                    tagIds
                  )
                }
              </For>
            </Show>

            {/* Leaf items – shown at leaf level OR when a non-leaf node had
                its items loaded directly (fallback when sub-dimension has no matches) */}
            {(() => {
              const pathKey = path.join(',');
              const fb = fallbackItems().get(pathKey);
              const showLeaf = isLeaf || fb !== undefined;
              const items = fb ? fb.items : node.items;
              return (
                <Show when={showLeaf && !node.loading}>
                  <Show
                    when={items.length > 0}
                    fallback={
                      <div class="tree-empty-leaf">
                        {props.untaggedLabel || 'No items'}
                      </div>
                    }
                  >
                    <div class="tree-items">
                      <For each={items.slice(0, maxLeaf())}>
                        {(item) => (
                          <div
                            class="tree-item"
                            onClick={(e) => {
                              e.stopPropagation();
                              props.onResourceClick?.(item);
                            }}
                          >
                            <Show
                              when={props.renderResource}
                              fallback={
                                <DefaultResourceRow
                                  item={item}
                                  onClick={props.onResourceClick}
                                />
                              }
                            >
                              {props.renderResource!(item)}
                            </Show>
                          </div>
                        )}
                      </For>
                      <Show when={items.length > maxLeaf()}>
                        <div class="tree-more">
                          +{items.length - maxLeaf()} more…
                        </div>
                      </Show>
                    </div>
                  </Show>
                </Show>
              );
            })()}
          </div>
        </Show>
      </div>
    );
  };

  return (
    <div class="castmill-resource-tree">
      {/* Dimension selector */}
      <Show
        when={props.tagGroups.length > 0}
        fallback={
          <div class="tree-empty">
            {props.emptyText || 'Create tag groups to organize resources.'}
          </div>
        }
      >
        <div class="dimension-bar">
          <span class="dimension-label">
            {props.dimensionLabel || 'Organize by'}:
          </span>
          <div class="dimension-selectors">
            <For each={dimensions()}>
              {(groupIdx, level) => (
                <div class="dimension-chip">
                  <Dropdown
                    label={props.tagGroups[groupIdx]?.name || ''}
                    items={props.tagGroups.map((group, gIdx) => ({
                      value: gIdx.toString(),
                      name: group.name,
                    }))}
                    value={groupIdx.toString()}
                    onSelectChange={(value) => {
                      if (value !== null) {
                        setDimensionAt(level(), parseInt(value));
                      }
                    }}
                    variant="inline"
                  />

                  <Show when={dimensions().length > 1}>
                    <button
                      class="dimension-remove"
                      onClick={() => removeDimension(level())}
                      title="Remove level"
                    >
                      ×
                    </button>
                  </Show>
                </div>
              )}
            </For>

            <Show when={dimensions().length < props.tagGroups.length}>
              <button
                class="dimension-add"
                onClick={addDimension}
                title="Add level"
              >
                +
              </button>
            </Show>
          </div>
        </div>

        {/* Tree */}
        <div class="tree-container">
          <Show
            when={!rootLoading()}
            fallback={
              <div class="tree-skeleton root">
                <div class="tree-skeleton-row">
                  <div class="tree-skeleton-chevron" />
                  <div class="tree-skeleton-badge" />
                  <div class="tree-skeleton-text" />
                </div>
                <div class="tree-skeleton-row">
                  <div class="tree-skeleton-chevron" />
                  <div class="tree-skeleton-badge" />
                  <div class="tree-skeleton-text short" />
                </div>
                <div class="tree-skeleton-row">
                  <div class="tree-skeleton-chevron" />
                  <div class="tree-skeleton-badge" />
                  <div class="tree-skeleton-text" />
                </div>
                <div class="tree-skeleton-row">
                  <div class="tree-skeleton-chevron" />
                  <div class="tree-skeleton-badge" />
                  <div class="tree-skeleton-text short" />
                </div>
              </div>
            }
          >
            <Show
              when={treeNodes.length > 0}
              fallback={
                <div class="tree-empty">No tags in this group yet.</div>
              }
            >
              <For each={treeNodes}>
                {(node, idx) => renderNode(node, [idx()], 0, 0, [])}
              </For>
            </Show>
          </Show>
        </div>
      </Show>
    </div>
  );
};

// Default resource row renderer
const DefaultResourceRow: Component<{
  item: TreeResourceItem;
  onClick?: (item: TreeResourceItem) => void;
}> = (props) => {
  return (
    <div class="default-resource-row">
      <Show
        when={props.item.thumbnail}
        fallback={
          <div class="resource-icon">
            <IconWrapper icon={VsFileMedia} />
          </div>
        }
      >
        <img
          class="resource-thumbnail"
          src={props.item.thumbnail}
          alt={props.item.name}
          loading="lazy"
        />
      </Show>
      <span class="resource-name">{props.item.name}</span>
    </div>
  );
};
