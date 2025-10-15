# Visual Explanation of the Bug Fix

## The Problem (Before)

```
┌─────────────────────────────────────────────────────┐
│  Page 1: Members A, B, C, D, E                      │
│  User selects: A, B                                 │
│  selectedMembers() = Set{A, B}                      │
│  data() = [A, B, C, D, E]                          │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│  User navigates to Page 2                           │
│  Page 2: Members F, G, H, I, J                      │
│  User selects: F                                    │
│  selectedMembers() = Set{A, B, F}  ← Still has A,B! │
│  data() = [F, G, H, I, J]          ← No A,B here!  │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│  User clicks "Delete Selected"                      │
│                                                     │
│  Dialog tries to display:                           │
│  for each id in selectedMembers():                  │
│    member = data().find(d => d.user_id === id)     │
│                                                     │
│  Results:                                           │
│  - A: data().find() → undefined ❌                  │
│  - B: data().find() → undefined ❌                  │
│  - F: data().find() → Member F ✓                   │
│                                                     │
│  Dialog shows:                                      │
│    - undefined                                      │
│    - undefined                                      │
│    - User F                                         │
└─────────────────────────────────────────────────────┘
```

## The Solution (After)

```
┌─────────────────────────────────────────────────────┐
│  Page 1: Members A, B, C, D, E                      │
│  User selects: A, B                                 │
│  selectedMembers() = Set{A, B}                      │
│  selectedMembersMap() = Map{                        │
│    A: {user: {name: "Alice"}, user_id: "A"},       │
│    B: {user: {name: "Bob"}, user_id: "B"}          │
│  }                                                  │
│  data() = [A, B, C, D, E]                          │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│  User navigates to Page 2                           │
│  Page 2: Members F, G, H, I, J                      │
│  User selects: F                                    │
│  selectedMembers() = Set{A, B, F}                   │
│  selectedMembersMap() = Map{                        │
│    A: {user: {name: "Alice"}, user_id: "A"},  ← Preserved!│
│    B: {user: {name: "Bob"}, user_id: "B"},    ← Preserved!│
│    F: {user: {name: "Frank"}, user_id: "F"}   ← Added!   │
│  }                                                  │
│  data() = [F, G, H, I, J]                          │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│  User clicks "Delete Selected"                      │
│                                                     │
│  Dialog displays:                                   │
│  for each member in selectedMembersMap().values(): │
│    show member.user.name                           │
│                                                     │
│  Dialog shows:                                      │
│    - Alice                                          │
│    - Bob                                            │
│    - Frank                                          │
│                                                     │
│  ✓ All names displayed correctly!                  │
└─────────────────────────────────────────────────────┘
```

## Key Implementation Details

### onRowSelect Handler Logic

```typescript
const onRowSelect = (rowsSelected: Set<string>) => {
  const previousSelection = selectedMembers();
  setSelectedMembers(rowsSelected);
  
  const newMap = new Map(selectedMembersMap());
  
  // Remove deselected members
  previousSelection.forEach((id) => {
    if (!rowsSelected.has(id)) {
      newMap.delete(id);  // Clean up map when user deselects
    }
  });
  
  // Add newly selected members
  rowsSelected.forEach((memberId) => {
    if (!newMap.has(memberId)) {
      const member = data().find((d) => d.user_id === memberId);
      if (member) {
        newMap.set(memberId, member);  // Store full member object
      }
    }
  });
  
  setSelectedMembersMap(newMap);
};
```

### Key Benefits

1. **Preserves member data across page changes** - Once a member is selected, their data is cached in the map
2. **Handles selection/deselection correctly** - Map is updated to add new selections and remove deselections
3. **No API calls needed** - Uses data already loaded in the current page
4. **Clean memory usage** - Map is cleared when deletion completes

### Edge Cases Handled

- ✓ Selecting members from multiple pages
- ✓ Deselecting members
- ✓ Navigating between pages while maintaining selection
- ✓ Clearing selection after deletion completes
