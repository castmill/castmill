# UI-Common Package - Agent Documentation

## Overview

The `ui-common` package (`packages/ui-common/`) provides shared UI components, utilities, and interfaces used across the Castmill platform. It's built with **SolidJS** and TypeScript, offering reusable, type-safe components for building consistent user interfaces.

## Key Technologies

- **SolidJS**: Reactive UI framework
- **TypeScript**: Type-safe component development
- **Vite**: Build tooling
- **Vitest**: Testing framework

## Core Components

### TableView Component

**Location**: `src/components/table-view/table-view.tsx`

The `TableView` component is a comprehensive data table with built-in pagination, sorting, searching, and filtering capabilities. It's used across the dashboard for displaying lists of resources (medias, playlists, channels, widgets, etc.).

#### Type Signature

```typescript
<TableView<IdType, Item extends ItemBase<IdType>>
```

- **IdType**: The type of the ID field (typically `string` or `number`)
- **Item**: The item type that must extend `ItemBase<IdType>`

#### Required Props

```typescript
{
  title: string;                    // Page title
  resource: string;                 // Resource name for display
  params?: [Params, SetParams];     // URL search params integration
  
  fetchData: (params: {
    page: { num: number; size: number };
    sortOptions: SortOptions;
    search?: string;
    filters?: Record<string, string | boolean>;
  }) => Promise<{ data: Item[]; count: number }>;
  
  table: {
    columns: Column<IdType, Item>[];
    actions?: TableAction<Item>[];
  };
  
  pagination: {
    itemsPerPage: number;
  };
  
  ref?: (ref: TableViewRef<IdType, Item>) => void;
}
```

#### ItemBase Interface

**Critical**: All items used with `TableView` MUST have a required `id` field matching `IdType`.

```typescript
type ItemBase<IdType = string> = Record<string, any> & { id: IdType };
```

**Common Issue**: If your data type has `id?: number` (optional), you must create a type alias with a required ID:

```typescript
// ❌ Won't work - optional ID
interface JsonWidget {
  id?: number;
  name: string;
}

// ✅ Works - required ID
type WidgetWithId = JsonWidget & { id: number };
```

### Column Interface

**Location**: `src/components/table/table.tsx`

Defines table columns with sorting and custom rendering.

```typescript
interface Column<IdType = string, Item extends ItemBase<IdType> = ItemBase<IdType>> {
  key: string;              // Property key to display
  title: string;            // Column header text (⚠️ NOT "label"!)
  sortable?: boolean;       // Enable sorting for this column
  render?: (item: Item) => JSX.Element;  // Custom cell renderer
}
```

**Important**: Use `title`, not `label` for column headers.

### TableAction Interface

Defines actions available for each row (view, edit, delete, etc.).

```typescript
interface TableAction<Item> {
  icon: Component | string;           // Icon component or emoji
  label: string;                      // Action label
  props?: (item: Item) => Record<string, any>;  // Dynamic props
  handler: (item: Item) => void;      // Action handler
}
```

### SortOptions Interface

**Location**: `src/interfaces/sort-options.interface.ts`

```typescript
interface SortOptions {
  key?: string;                      // Column key to sort by
  direction: 'ascending' | 'descending';  // Sort direction
}
```

**Important**: 
- Use `key`, not `field`
- Use `'ascending'` or `'descending'`, not `'asc'` or `'desc'`

### Modal Component

**Location**: `src/components/modal/modal.tsx`

A modal dialog component with loading states, error handling, and animations.

```typescript
interface ModalProps {
  onClose: () => void;
  children: JSX.Element;
  title: string;
  description: string;        // Required field
  successMessage?: string;
  errorMessage?: string;
  loading?: boolean;
  autoCloseDelay?: number;
  showRetryButton?: boolean;
  contentClass?: string;
  ref?: (ref: ModalRef) => void;
}
```

#### Correct Usage Pattern

```typescript
// 1. Create state for modal visibility
const [showModal, setShowModal] = createSignal<MyItem | undefined>();
let modalRef: ModalRef | undefined = undefined;

// 2. Wrap Modal in Show component
<Show when={showModal()}>
  <Modal
    ref={(ref: ModalRef) => (modalRef = ref)}
    title={showModal()!.name}
    description={showModal()!.description || 'Default description'}
    onClose={() => setShowModal(undefined)}
  >
    {/* Modal content */}
  </Modal>
</Show>
```

**Common Mistakes**:
- ❌ Don't use: `<Modal ref={setShowModal}>`
- ❌ Don't forget the `description` prop (it's required)
- ❌ Don't forget to set text colors in modal content (default may inherit white text)
- ✅ Do use: `<Show when={...}>` wrapper
- ✅ Do explicitly set `color: #333;` or similar on modal content elements

### TableViewRef Interface

Provides methods to interact with the table programmatically.

```typescript
interface TableViewRef<IdType, Item extends ItemBase<IdType>> {
  reloadData: () => Promise<void>;         // Refresh table data
  updateItem: (itemId: IdType, item: Partial<Item>) => void;  // Update single item
}
```

## Common Patterns

### 1. Creating a Resource List Page

```typescript
import { TableView, TableViewRef, Column, TableAction, SortOptions } from '@castmill/ui-common';

// Define item type with required ID
type MyItemWithId = MyItem & { id: number };

const MyPage: Component<{ store: AddonStore; params: any }> = (props) => {
  const [tableRef, setRef] = createSignal<TableViewRef<number, MyItemWithId>>();

  const fetchData = async ({
    page,
    sortOptions,
    search,
    filters,
  }: {
    page: { num: number; size: number };
    sortOptions: SortOptions;
    search?: string;
    filters?: Record<string, string | boolean>;
  }) => {
    const result = await MyService.fetchItems(
      props.store.env.baseUrl,
      props.store.organizations.selectedId,
      {
        page: page.num,
        page_size: page.size,
        sortOptions,
        search,
        filters,
      }
    );

    // Cast if necessary to ensure required ID
    return {
      data: result.data as MyItemWithId[],
      count: result.count,
    };
  };

  const columns: Column<number, MyItemWithId>[] = [
    {
      key: 'name',
      title: 'Name',  // Use 'title', not 'label'
      sortable: true,
      render: (item) => <div>{item.name}</div>,
    },
    {
      key: 'created_at',
      title: 'Created',
      sortable: true,
    },
  ];

  const actions: TableAction<MyItemWithId>[] = [
    {
      label: 'View',
      icon: BsEye,
      handler: (item) => console.log(item),
    },
  ];

  return (
    <TableView<number, MyItemWithId>
      title="My Resources"
      resource="items"
      params={props.params}
      fetchData={fetchData}
      ref={setRef}
      table={{ columns, actions }}
      pagination={{ itemsPerPage: 10 }}
    />
  );
};
```

### 2. Implementing Service Methods with Proper SortOptions

When implementing service methods that handle sorting, use the correct property names:

```typescript
// ✅ Correct
if (options.sortOptions?.key) {
  const { key, direction } = options.sortOptions;
  filteredData.sort((a, b) => {
    const comparison = String(a[key]).localeCompare(String(b[key]));
    return direction === 'ascending' ? comparison : -comparison;
  });
}

// ❌ Wrong - uses 'field' and 'asc'/'desc'
if (options.sortOptions.field) {
  const { field, direction } = options.sortOptions;
  return direction === 'asc' ? comparison : -comparison;
}
```

## Type Safety Best Practices

### 1. Always Extend ItemBase

When creating types for use with TableView:

```typescript
// Option A: Intersection type (recommended for existing types)
type WidgetWithId = JsonWidget & { id: number };

// Option B: Interface extension (for new types)
interface Widget extends ItemBase<number> {
  name: string;
  description?: string;
}
```

### 2. Match Generic Parameters

When using `TableView`, `Column`, `TableAction`, and `TableViewRef`, ensure all use the same type parameters:

```typescript
type MyItem = MyData & { id: number };

const columns: Column<number, MyItem>[] = [...];
const actions: TableAction<MyItem>[] = [...];
const [tableRef, setRef] = createSignal<TableViewRef<number, MyItem>>();

<TableView<number, MyItem>
  columns={columns}
  actions={actions}
  ref={setRef}
/>
```

### 3. Handle Optional IDs from APIs

Backend APIs often return data with optional IDs in TypeScript definitions, but actual responses always have IDs. Handle this with type assertions:

```typescript
const result = await MyService.fetch();
return {
  data: result.data as MyItemWithId[],  // Assert required ID
  count: result.count,
};
```

## Testing Components

The package uses Vitest with a custom setup file (`test-setup.ts`). When writing tests:

```typescript
import { render } from '@solidjs/testing-library';
import { MyComponent } from './my-component';

describe('MyComponent', () => {
  it('should render correctly', () => {
    const { getByText } = render(() => <MyComponent />);
    expect(getByText('Expected Text')).toBeInTheDocument();
  });
});
```

## Common Pitfalls & Solutions

| Issue | Problem | Solution |
|-------|---------|----------|
| "Cannot read property 'field'" | Using wrong SortOptions property | Use `sortOptions?.key` not `sortOptions.field` |
| "Type 'ascending' has no overlap with 'asc'" | Using wrong direction values | Use `'ascending'`/`'descending'` not `'asc'`/`'desc'` |
| "'label' does not exist in type Column" | Wrong column property name | Use `title` not `label` |
| "Property 'id' is missing" | Optional ID in type | Create `type WithId = MyType & { id: IdType }` |
| Modal shows immediately | Wrong ref usage | Wrap in `<Show when={...}>` component |
| "description is required" | Missing Modal prop | Always provide `description` prop |
| White boxes in modal content | Text color inherits white | Add `color: #333;` to content divs and pre tags |

## Component Exports

The package exports from `src/index.ts`. Common imports:

```typescript
import {
  // Layout Components
  Button,
  IconButton,
  Modal,
  ModalRef,
  
  // Table Components
  TableView,
  TableViewRef,
  Column,
  TableAction,
  Table,
  
  // Other Components
  ConfirmDialog,
  Pagination,
  Filter,
  ToolBar,
  CircularProgress,
  
  // Interfaces
  SortOptions,
  ItemBase,
  
  // Utilities
  ResourcesObserver,
} from '@castmill/ui-common';
```

## Build & Development

```bash
# Build the package
yarn workspace @castmill/ui-common build

# Run tests
yarn workspace @castmill/ui-common test

# Type check
yarn workspace @castmill/ui-common type-check
```

## Architecture Notes

- Components are built with **SolidJS**, not React
- Use `createSignal` for state, not `useState`
- Use `<Show when={...}>` instead of conditional rendering with `&&`
- JSX in SolidJS uses `class` not `className`
- Props are accessed directly, not destructured in the function signature (or use a store pattern)

## Future Improvements

- Add comprehensive Storybook documentation
- Expand test coverage for all components
- Document ResourcesObserver usage patterns
- Add examples for complex table customizations
- Document theming and styling patterns

---

**Last Updated**: October 2025  
**Maintained By**: AI Agent Documentation System  
**Related Docs**: See `agents/README.md` for complete project context
