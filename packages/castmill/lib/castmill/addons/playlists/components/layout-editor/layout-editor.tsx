import {
  Component,
  For,
  createSignal,
  createEffect,
  Show,
  onMount,
  onCleanup,
} from 'solid-js';
import type {
  LayoutZone,
  LayoutOptionValue,
  LayoutFieldAttributes,
} from '@castmill/player';
import { Button, FormItem } from '@castmill/ui-common';
import {
  BsPlus,
  BsTrash,
  BsArrowUp,
  BsArrowDown,
  BsGrid,
  BsArrowsFullscreen,
  BsAspectRatio,
  BsColumns,
  BsLayoutSplit,
  BsLayoutThreeColumns,
  BsLock,
  BsUnlock,
} from 'solid-icons/bs';
import './layout-editor.scss';

/**
 * Layout template definitions for quick layout creation
 */
interface LayoutTemplate {
  id: string;
  name: string;
  icon: string;
  zones: Array<{ x: number; y: number; width: number; height: number }>;
}

const LAYOUT_TEMPLATES: LayoutTemplate[] = [
  {
    id: 'full',
    name: 'Full Screen',
    icon: '⬜',
    zones: [{ x: 0, y: 0, width: 100, height: 100 }],
  },
  {
    id: 'split-h-2',
    name: '2 Columns',
    icon: '▌▐',
    zones: [
      { x: 0, y: 0, width: 50, height: 100 },
      { x: 50, y: 0, width: 50, height: 100 },
    ],
  },
  {
    id: 'split-h-3',
    name: '3 Columns',
    icon: '▌│▐',
    zones: [
      { x: 0, y: 0, width: 33.33, height: 100 },
      { x: 33.33, y: 0, width: 33.34, height: 100 },
      { x: 66.67, y: 0, width: 33.33, height: 100 },
    ],
  },
  {
    id: 'split-v-2',
    name: '2 Rows',
    icon: '▀▄',
    zones: [
      { x: 0, y: 0, width: 100, height: 50 },
      { x: 0, y: 50, width: 100, height: 50 },
    ],
  },
  {
    id: 'split-v-3',
    name: '3 Rows',
    icon: '▔━▁',
    zones: [
      { x: 0, y: 0, width: 100, height: 33.33 },
      { x: 0, y: 33.33, width: 100, height: 33.34 },
      { x: 0, y: 66.67, width: 100, height: 33.33 },
    ],
  },
  {
    id: 'grid-2x2',
    name: '2×2 Grid',
    icon: '▚',
    zones: [
      { x: 0, y: 0, width: 50, height: 50 },
      { x: 50, y: 0, width: 50, height: 50 },
      { x: 0, y: 50, width: 50, height: 50 },
      { x: 50, y: 50, width: 50, height: 50 },
    ],
  },
  {
    id: 'grid-3x3',
    name: '3×3 Grid',
    icon: '▦',
    zones: [
      { x: 0, y: 0, width: 33.33, height: 33.33 },
      { x: 33.33, y: 0, width: 33.34, height: 33.33 },
      { x: 66.67, y: 0, width: 33.33, height: 33.33 },
      { x: 0, y: 33.33, width: 33.33, height: 33.34 },
      { x: 33.33, y: 33.33, width: 33.34, height: 33.34 },
      { x: 66.67, y: 33.33, width: 33.33, height: 33.34 },
      { x: 0, y: 66.67, width: 33.33, height: 33.33 },
      { x: 33.33, y: 66.67, width: 33.34, height: 33.33 },
      { x: 66.67, y: 66.67, width: 33.33, height: 33.33 },
    ],
  },
  {
    id: 'main-sidebar',
    name: 'Main + Sidebar',
    icon: '▌▏',
    zones: [
      { x: 0, y: 0, width: 70, height: 100 },
      { x: 70, y: 0, width: 30, height: 100 },
    ],
  },
  {
    id: 'header-content',
    name: 'Header + Content',
    icon: '▔▇',
    zones: [
      { x: 0, y: 0, width: 100, height: 20 },
      { x: 0, y: 20, width: 100, height: 80 },
    ],
  },
  {
    id: 'pip',
    name: 'Picture in Picture',
    icon: '▢◱',
    zones: [
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 65, y: 65, width: 30, height: 30 },
    ],
  },
];

/**
 * Common zone aspect ratios
 */
const ZONE_ASPECT_RATIOS = ['16:9', '9:16', '4:3', '3:4', '1:1', '21:9'];

/**
 * Fractional size options
 */
const FRACTIONAL_SIZES = [
  { label: '100%', value: 100 },
  { label: '1/2', value: 50 },
  { label: '1/3', value: 33.33 },
  { label: '2/3', value: 66.67 },
  { label: '1/4', value: 25 },
  { label: '3/4', value: 75 },
];

/**
 * Generates a unique ID for a new zone
 */
const generateZoneId = (): string => {
  return `zone-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Parses aspect ratio string (e.g., "16:9") into width/height values
 */
export const parseAspectRatio = (
  aspectRatio: string
): { width: number; height: number } => {
  const parts = aspectRatio.split(':');
  if (parts.length !== 2) {
    return { width: 16, height: 9 }; // Default fallback
  }
  const width = parseInt(parts[0], 10);
  const height = parseInt(parts[1], 10);
  if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0) {
    return { width: 16, height: 9 };
  }
  return { width, height };
};

/**
 * Calculates canvas dimensions to fit within a container while maintaining aspect ratio
 */
export const calculateCanvasSize = (
  containerWidth: number,
  containerHeight: number,
  aspectRatio: string
): { width: number; height: number } => {
  const { width: arW, height: arH } = parseAspectRatio(aspectRatio);
  const aspectValue = arW / arH;

  // Fit within container
  let canvasWidth = containerWidth;
  let canvasHeight = containerWidth / aspectValue;

  if (canvasHeight > containerHeight) {
    canvasHeight = containerHeight;
    canvasWidth = containerHeight * aspectValue;
  }

  return { width: Math.floor(canvasWidth), height: Math.floor(canvasHeight) };
};

interface LayoutEditorProps {
  /** Current layout value */
  value: LayoutOptionValue;
  /** Callback when layout changes */
  onChange: (value: LayoutOptionValue) => void;
  /** Schema attributes for the field */
  schema?: LayoutFieldAttributes;
  /** Available playlists for zone assignment */
  playlists?: Array<{ id: number; name: string }>;
  /** Callback to fetch playlists */
  fetchPlaylists?: () => Promise<Array<{ id: number; name: string }>>;
  /** Organization ID for playlist fetching */
  organizationId?: string;
  /** Base URL for API calls */
  baseUrl?: string;
}

const DEFAULT_ASPECT_RATIOS = ['16:9', '9:16', '4:3', '1:1', '21:9'];

export const LayoutEditor: Component<LayoutEditorProps> = (props) => {
  let canvasContainerRef: HTMLDivElement | undefined;
  let canvasRef: HTMLDivElement | undefined;

  const [selectedZoneId, setSelectedZoneId] = createSignal<string | null>(null);
  const [canvasSize, setCanvasSize] = createSignal({ width: 400, height: 225 });
  const [isDragging, setIsDragging] = createSignal(false);
  const [isResizing, setIsResizing] = createSignal(false);
  const [dragStart, setDragStart] = createSignal({ x: 0, y: 0 });
  const [dragZoneStart, setDragZoneStart] = createSignal({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });
  const [resizeHandle, setResizeHandle] = createSignal<string | null>(null);
  const [isCustomAspectRatio, setIsCustomAspectRatio] = createSignal(false);
  const [customWidth, setCustomWidth] = createSignal(16);
  const [customHeight, setCustomHeight] = createSignal(9);
  const [showTemplates, setShowTemplates] = createSignal(false);
  const [zoneAspectLocks, setZoneAspectLocks] = createSignal<
    Record<string, string | null>
  >({});

  // Use refs for drag state to avoid stale closures in event listeners
  let dragStateRef = {
    isDragging: false,
    isResizing: false,
    selectedZoneId: null as string | null,
    dragStart: { x: 0, y: 0 },
    dragZoneStart: { x: 0, y: 0, width: 0, height: 0 },
    resizeHandle: null as string | null,
    // Store canvas bounds at drag start to avoid issues with stale refs
    canvasBounds: { left: 0, top: 0, width: 0, height: 0 },
  };

  // Available aspect ratios
  const aspectRatios = () =>
    props.schema?.aspectRatios || DEFAULT_ASPECT_RATIOS;

  // Check if current aspect ratio is custom (not in presets)
  createEffect(() => {
    const currentRatio = props.value.aspectRatio;
    const presets = aspectRatios();
    const isCustom = !presets.includes(currentRatio);
    setIsCustomAspectRatio(isCustom);
    if (isCustom) {
      const parsed = parseAspectRatio(currentRatio);
      setCustomWidth(parsed.width);
      setCustomHeight(parsed.height);
    }
  });

  // Update canvas size when container resizes
  const updateCanvasSize = () => {
    if (!canvasContainerRef) return;
    const containerRect = canvasContainerRef.getBoundingClientRect();
    // Leave some padding
    const containerWidth = containerRect.width - 40;
    const containerHeight = 400; // Fixed max height for editor
    const size = calculateCanvasSize(
      containerWidth,
      containerHeight,
      props.value.aspectRatio
    );
    setCanvasSize(size);
  };

  onMount(() => {
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
  });

  onCleanup(() => {
    window.removeEventListener('resize', updateCanvasSize);
    // Clean up any document-level listeners that might still be active
    document.removeEventListener('mousemove', handleDocumentMouseMove);
    document.removeEventListener('mouseup', handleDocumentMouseUp);
  });

  // Update canvas when aspect ratio changes
  createEffect(() => {
    props.value.aspectRatio; // Track changes
    updateCanvasSize();
  });

  // Convert percentage to pixel position on canvas
  const percentToPixel = (
    percent: number,
    dimension: 'width' | 'height'
  ): number => {
    const size = canvasSize();
    return (percent / 100) * (dimension === 'width' ? size.width : size.height);
  };

  // Convert pixel position to percentage
  const pixelToPercent = (
    pixel: number,
    dimension: 'width' | 'height'
  ): number => {
    const size = canvasSize();
    return (pixel / (dimension === 'width' ? size.width : size.height)) * 100;
  };

  // Add a new zone
  const addZone = () => {
    console.log('[LayoutEditor] addZone called');
    console.log('[LayoutEditor] current zones:', props.value.zones);

    const newZone: LayoutZone = {
      id: generateZoneId(),
      name: `Zone ${props.value.zones.length + 1}`,
      rect: { x: 10, y: 10, width: 30, height: 30 },
      zIndex: props.value.zones.length + 1,
    };

    console.log('[LayoutEditor] new zone:', newZone);

    const newValue = {
      ...props.value,
      zones: [...props.value.zones, newZone],
    };

    console.log('[LayoutEditor] calling onChange with:', newValue);
    props.onChange(newValue);

    setSelectedZoneId(newZone.id);
  };

  // Delete a zone
  const deleteZone = (zoneId: string) => {
    props.onChange({
      ...props.value,
      zones: props.value.zones.filter((z) => z.id !== zoneId),
    });
    if (selectedZoneId() === zoneId) {
      setSelectedZoneId(null);
    }
  };

  // Update a zone
  const updateZone = (zoneId: string, updates: Partial<LayoutZone>) => {
    props.onChange({
      ...props.value,
      zones: props.value.zones.map((z) =>
        z.id === zoneId ? { ...z, ...updates } : z
      ),
    });
  };

  // Apply a layout template
  const applyTemplate = (template: LayoutTemplate) => {
    const newZones: LayoutZone[] = template.zones.map((rect, index) => ({
      id: generateZoneId(),
      name: `Zone ${index + 1}`,
      rect: { ...rect },
      zIndex: index + 1,
    }));

    props.onChange({
      ...props.value,
      zones: newZones,
    });

    setShowTemplates(false);
    if (newZones.length > 0) {
      setSelectedZoneId(newZones[0].id);
    }
  };

  // Set zone to fill width (100%)
  const fillWidth = (zoneId: string) => {
    updateZone(zoneId, {
      rect: {
        ...props.value.zones.find((z) => z.id === zoneId)!.rect,
        x: 0,
        width: 100,
      },
    });
  };

  // Set zone to fill height (100%)
  const fillHeight = (zoneId: string) => {
    updateZone(zoneId, {
      rect: {
        ...props.value.zones.find((z) => z.id === zoneId)!.rect,
        y: 0,
        height: 100,
      },
    });
  };

  // Set zone to fill both width and height (100%)
  const fillBoth = (zoneId: string) => {
    updateZone(zoneId, {
      rect: { x: 0, y: 0, width: 100, height: 100 },
    });
  };

  // Set zone width to a fractional value
  const setZoneWidth = (zoneId: string, width: number) => {
    const zone = props.value.zones.find((z) => z.id === zoneId);
    if (!zone) return;
    const newWidth = Math.min(100 - zone.rect.x, width);
    updateZone(zoneId, {
      rect: { ...zone.rect, width: newWidth },
    });
  };

  // Set zone height to a fractional value
  const setZoneHeight = (zoneId: string, height: number) => {
    const zone = props.value.zones.find((z) => z.id === zoneId);
    if (!zone) return;
    const newHeight = Math.min(100 - zone.rect.y, height);
    updateZone(zoneId, {
      rect: { ...zone.rect, height: newHeight },
    });
  };

  // Set zone aspect ratio (adjusts height based on width)
  const setZoneAspectRatio = (zoneId: string, aspectRatio: string | null) => {
    setZoneAspectLocks((prev) => ({ ...prev, [zoneId]: aspectRatio }));

    if (aspectRatio) {
      const zone = props.value.zones.find((z) => z.id === zoneId);
      if (!zone) return;

      // Calculate layout's aspect ratio in actual pixels
      const layoutAR = parseAspectRatio(props.value.aspectRatio);
      const layoutRatio = layoutAR.width / layoutAR.height;

      // Calculate zone's target aspect ratio
      const zoneAR = parseAspectRatio(aspectRatio);
      const zoneRatio = zoneAR.width / zoneAR.height;

      // Adjust zone's height based on width, accounting for layout's aspect ratio
      // Zone width in pixels = zone.rect.width% * layoutWidth
      // Zone height in pixels = zone.rect.height% * layoutHeight
      // For target aspect ratio: (width% * layoutW) / (height% * layoutH) = zoneRatio
      // => height% = (width% * layoutW) / (zoneRatio * layoutH)
      // => height% = width% * layoutRatio / zoneRatio
      const newHeight = (zone.rect.width * layoutRatio) / zoneRatio;
      const clampedHeight = Math.min(100 - zone.rect.y, Math.max(5, newHeight));

      updateZone(zoneId, {
        rect: { ...zone.rect, height: Math.round(clampedHeight * 10) / 10 },
      });
    }
  };

  // Get the aspect lock for a zone
  const getZoneAspectLock = (zoneId: string): string | null => {
    return zoneAspectLocks()[zoneId] || null;
  };

  // Distribute zones evenly horizontally
  const distributeHorizontally = () => {
    const zones = props.value.zones;
    if (zones.length < 2) return;

    const width = 100 / zones.length;
    const newZones = zones.map((zone, index) => ({
      ...zone,
      rect: {
        ...zone.rect,
        x: index * width,
        width: width,
      },
    }));

    props.onChange({ ...props.value, zones: newZones });
  };

  // Distribute zones evenly vertically
  const distributeVertically = () => {
    const zones = props.value.zones;
    if (zones.length < 2) return;

    const height = 100 / zones.length;
    const newZones = zones.map((zone, index) => ({
      ...zone,
      rect: {
        ...zone.rect,
        y: index * height,
        height: height,
      },
    }));

    props.onChange({ ...props.value, zones: newZones });
  };

  // Move zone up in z-order
  const moveZoneUp = (zoneId: string) => {
    const zone = props.value.zones.find((z) => z.id === zoneId);
    if (!zone) return;
    const maxZ = Math.max(...props.value.zones.map((z) => z.zIndex));
    if (zone.zIndex < maxZ) {
      updateZone(zoneId, { zIndex: zone.zIndex + 1 });
    }
  };

  // Move zone down in z-order
  const moveZoneDown = (zoneId: string) => {
    const zone = props.value.zones.find((z) => z.id === zoneId);
    if (!zone) return;
    const minZ = Math.min(...props.value.zones.map((z) => z.zIndex));
    if (zone.zIndex > minZ) {
      updateZone(zoneId, { zIndex: zone.zIndex - 1 });
    }
  };

  // Handle mouse down on zone (start drag)
  const handleZoneMouseDown = (e: MouseEvent, zoneId: string) => {
    e.preventDefault();
    e.stopPropagation();

    const zone = props.value.zones.find((z) => z.id === zoneId);
    if (!zone || !canvasRef) return;

    // Capture canvas bounds NOW, before any updates happen
    const canvasRect = canvasRef.getBoundingClientRect();

    setSelectedZoneId(zoneId);
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setDragZoneStart({
      x: zone.rect.x,
      y: zone.rect.y,
      width: zone.rect.width,
      height: zone.rect.height,
    });

    // Update ref for use in document-level listeners
    dragStateRef = {
      isDragging: true,
      isResizing: false,
      selectedZoneId: zoneId,
      dragStart: { x: e.clientX, y: e.clientY },
      dragZoneStart: {
        x: zone.rect.x,
        y: zone.rect.y,
        width: zone.rect.width,
        height: zone.rect.height,
      },
      resizeHandle: null,
      canvasBounds: {
        left: canvasRect.left,
        top: canvasRect.top,
        width: canvasRect.width,
        height: canvasRect.height,
      },
    };

    // Attach document-level listeners to capture mouse even outside the canvas
    document.addEventListener('mousemove', handleDocumentMouseMove);
    document.addEventListener('mouseup', handleDocumentMouseUp);
  };

  // Handle mouse down on resize handle
  const handleResizeMouseDown = (
    e: MouseEvent,
    zoneId: string,
    handle: string
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const zone = props.value.zones.find((z) => z.id === zoneId);
    if (!zone || !canvasRef) return;

    // Capture canvas bounds NOW, before any updates happen
    const canvasRect = canvasRef.getBoundingClientRect();

    setSelectedZoneId(zoneId);
    setIsResizing(true);
    setResizeHandle(handle);
    setDragStart({ x: e.clientX, y: e.clientY });
    setDragZoneStart({
      x: zone.rect.x,
      y: zone.rect.y,
      width: zone.rect.width,
      height: zone.rect.height,
    });

    // Update ref for use in document-level listeners
    dragStateRef = {
      isDragging: false,
      isResizing: true,
      selectedZoneId: zoneId,
      dragStart: { x: e.clientX, y: e.clientY },
      dragZoneStart: {
        x: zone.rect.x,
        y: zone.rect.y,
        width: zone.rect.width,
        height: zone.rect.height,
      },
      resizeHandle: handle,
      canvasBounds: {
        left: canvasRect.left,
        top: canvasRect.top,
        width: canvasRect.width,
        height: canvasRect.height,
      },
    };

    // Attach document-level listeners to capture mouse even outside the canvas
    document.addEventListener('mousemove', handleDocumentMouseMove);
    document.addEventListener('mouseup', handleDocumentMouseUp);
  };

  // Handle mouse move at document level (drag or resize) - uses ref to avoid stale closures
  const handleDocumentMouseMove = (e: MouseEvent) => {
    if (!dragStateRef.isDragging && !dragStateRef.isResizing) return;

    const zoneId = dragStateRef.selectedZoneId;
    if (!zoneId) return;

    // Use stored canvas bounds from drag start (avoids stale ref issues)
    const canvasBounds = dragStateRef.canvasBounds;
    if (canvasBounds.width === 0 || canvasBounds.height === 0) return;

    // Calculate mouse position as percentage of canvas
    const mouseXPercent =
      ((e.clientX - canvasBounds.left) / canvasBounds.width) * 100;
    const mouseYPercent =
      ((e.clientY - canvasBounds.top) / canvasBounds.height) * 100;

    const start = dragStateRef.dragZoneStart;
    const startMouse = dragStateRef.dragStart;

    // Calculate the offset from where we clicked within the zone
    const clickOffsetXPercent =
      ((startMouse.x - canvasBounds.left) / canvasBounds.width) * 100 - start.x;
    const clickOffsetYPercent =
      ((startMouse.y - canvasBounds.top) / canvasBounds.height) * 100 - start.y;

    if (dragStateRef.isDragging) {
      // Move the zone - position is mouse position minus click offset
      let newX = mouseXPercent - clickOffsetXPercent;
      let newY = mouseYPercent - clickOffsetYPercent;

      // Clamp to boundaries
      newX = Math.max(0, Math.min(100 - start.width, newX));
      newY = Math.max(0, Math.min(100 - start.height, newY));

      updateZone(zoneId, {
        rect: {
          x: Math.round(newX * 10) / 10,
          y: Math.round(newY * 10) / 10,
          width: start.width,
          height: start.height,
        },
      });
    } else if (dragStateRef.isResizing) {
      const handle = dragStateRef.resizeHandle;
      let newX = start.x;
      let newY = start.y;
      let newWidth = start.width;
      let newHeight = start.height;

      // Calculate the edges of the zone at start
      const startRight = start.x + start.width;
      const startBottom = start.y + start.height;

      // East (right edge): set right edge to mouse position
      if (handle?.includes('e')) {
        const newRight = Math.max(newX + 5, Math.min(100, mouseXPercent));
        newWidth = newRight - newX;
      }

      // West (left edge): set left edge to mouse position
      if (handle?.includes('w')) {
        const rightEdge = handle?.includes('e') ? newX + newWidth : startRight;
        newX = Math.max(0, Math.min(rightEdge - 5, mouseXPercent));
        newWidth = rightEdge - newX;
      }

      // South (bottom edge): set bottom edge to mouse position
      if (handle?.includes('s')) {
        const newBottom = Math.max(newY + 5, Math.min(100, mouseYPercent));
        newHeight = newBottom - newY;
      }

      // North (top edge): set top edge to mouse position
      if (handle?.includes('n')) {
        const bottomEdge = handle?.includes('s')
          ? newY + newHeight
          : startBottom;
        newY = Math.max(0, Math.min(bottomEdge - 5, mouseYPercent));
        newHeight = bottomEdge - newY;
      }

      updateZone(zoneId, {
        rect: {
          x: Math.round(newX * 10) / 10,
          y: Math.round(newY * 10) / 10,
          width: Math.round(newWidth * 10) / 10,
          height: Math.round(newHeight * 10) / 10,
        },
      });
    }
  };

  // Handle mouse up at document level - removes listeners
  const handleDocumentMouseUp = () => {
    // Reset ref state
    dragStateRef.isDragging = false;
    dragStateRef.isResizing = false;
    dragStateRef.resizeHandle = null;

    // Reset signal state
    setIsDragging(false);
    setIsResizing(false);
    setResizeHandle(null);

    // Remove document-level listeners
    document.removeEventListener('mousemove', handleDocumentMouseMove);
    document.removeEventListener('mouseup', handleDocumentMouseUp);
  };

  // Change aspect ratio
  const handleAspectRatioChange = (newRatio: string) => {
    if (newRatio === 'custom') {
      setIsCustomAspectRatio(true);
      // Parse current aspect ratio and use those values as starting point
      const parsed = parseAspectRatio(props.value.aspectRatio);
      setCustomWidth(parsed.width);
      setCustomHeight(parsed.height);
      // Don't change the aspect ratio yet - let user modify the values
    } else {
      setIsCustomAspectRatio(false);
      props.onChange({
        ...props.value,
        aspectRatio: newRatio,
      });
    }
  };

  // Handle custom aspect ratio input changes
  const handleCustomAspectRatioChange = (width: number, height: number) => {
    // Clamp values between 1 and 32
    const clampedWidth = Math.max(1, Math.min(32, width));
    const clampedHeight = Math.max(1, Math.min(32, height));

    setCustomWidth(clampedWidth);
    setCustomHeight(clampedHeight);
    const customRatio = `${clampedWidth}:${clampedHeight}`;
    props.onChange({
      ...props.value,
      aspectRatio: customRatio,
    });
  };

  // Get selected zone
  const selectedZone = () =>
    props.value.zones.find((z) => z.id === selectedZoneId());

  return (
    <div class="layout-editor">
      {/* Main Toolbar */}
      <div class="layout-editor__toolbar">
        <div class="layout-editor__toolbar-left">
          <div class="layout-editor__aspect-ratio">
            <label>Aspect Ratio:</label>
            <select
              value={isCustomAspectRatio() ? 'custom' : props.value.aspectRatio}
              onChange={(e) => handleAspectRatioChange(e.currentTarget.value)}
            >
              <For each={aspectRatios()}>
                {(ratio) => <option value={ratio}>{ratio}</option>}
              </For>
              <option value="custom">Custom...</option>
            </select>
            <Show when={isCustomAspectRatio()}>
              <div class="layout-editor__custom-aspect-ratio">
                <input
                  type="number"
                  min="1"
                  max="32"
                  value={customWidth()}
                  onInput={(e) =>
                    handleCustomAspectRatioChange(
                      parseInt(e.currentTarget.value, 10) || 1,
                      customHeight()
                    )
                  }
                  class="layout-editor__aspect-input"
                />
                <span>:</span>
                <input
                  type="number"
                  min="1"
                  max="32"
                  value={customHeight()}
                  onInput={(e) =>
                    handleCustomAspectRatioChange(
                      customWidth(),
                      parseInt(e.currentTarget.value, 10) || 1
                    )
                  }
                  class="layout-editor__aspect-input"
                />
              </div>
            </Show>
          </div>
        </div>
        <div class="layout-editor__toolbar-right">
          <button
            class={`layout-editor__template-btn ${showTemplates() ? 'active' : ''}`}
            onClick={() => setShowTemplates(!showTemplates())}
            title="Layout Templates"
          >
            <BsGrid />
            <span>Templates</span>
          </button>
          <Button
            onClick={addZone}
            color="primary"
            icon={BsPlus}
            label="Add Zone"
          />
        </div>
      </div>

      {/* Layout Templates Panel */}
      <Show when={showTemplates()}>
        <div class="layout-editor__templates">
          <div class="layout-editor__templates-header">
            <h4>Quick Layout Templates</h4>
            <button
              class="layout-editor__close-btn"
              onClick={() => setShowTemplates(false)}
            >
              ×
            </button>
          </div>
          <div class="layout-editor__templates-grid">
            <For each={LAYOUT_TEMPLATES}>
              {(template) => (
                <button
                  class="layout-editor__template-item"
                  onClick={() => applyTemplate(template)}
                  title={template.name}
                >
                  <span class="template-icon">{template.icon}</span>
                  <span class="template-name">{template.name}</span>
                </button>
              )}
            </For>
          </div>
          <div class="layout-editor__templates-actions">
            <button
              class="layout-editor__action-btn"
              onClick={distributeHorizontally}
              disabled={props.value.zones.length < 2}
              title="Distribute all zones evenly in columns"
            >
              <BsColumns />
              <span>Distribute Horizontally</span>
            </button>
            <button
              class="layout-editor__action-btn"
              onClick={distributeVertically}
              disabled={props.value.zones.length < 2}
              title="Distribute all zones evenly in rows"
            >
              <BsLayoutSplit />
              <span>Distribute Vertically</span>
            </button>
          </div>
        </div>
      </Show>

      {/* Zone Quick Actions Bar (shown when zone selected) */}
      <Show when={selectedZone()}>
        {(zone) => (
          <div class="layout-editor__zone-toolbar">
            <div class="layout-editor__zone-toolbar-group">
              <span class="group-label">Size:</span>
              <button
                class="layout-editor__quick-btn"
                onClick={() => fillWidth(zone().id)}
                title="Fill Width (100%)"
              >
                ↔ Width
              </button>
              <button
                class="layout-editor__quick-btn"
                onClick={() => fillHeight(zone().id)}
                title="Fill Height (100%)"
              >
                ↕ Height
              </button>
              <button
                class="layout-editor__quick-btn"
                onClick={() => fillBoth(zone().id)}
                title="Fill Both (100% x 100%)"
              >
                <BsArrowsFullscreen /> Full
              </button>
            </div>

            <div class="layout-editor__zone-toolbar-group">
              <span class="group-label">Width:</span>
              <For each={FRACTIONAL_SIZES}>
                {(size) => (
                  <button
                    class={`layout-editor__fraction-btn ${
                      Math.abs(zone().rect.width - size.value) < 0.5
                        ? 'active'
                        : ''
                    }`}
                    onClick={() => setZoneWidth(zone().id, size.value)}
                    title={`Set width to ${size.label}`}
                  >
                    {size.label}
                  </button>
                )}
              </For>
            </div>

            <div class="layout-editor__zone-toolbar-group">
              <span class="group-label">Height:</span>
              <For each={FRACTIONAL_SIZES}>
                {(size) => (
                  <button
                    class={`layout-editor__fraction-btn ${
                      Math.abs(zone().rect.height - size.value) < 0.5
                        ? 'active'
                        : ''
                    }`}
                    onClick={() => setZoneHeight(zone().id, size.value)}
                    title={`Set height to ${size.label}`}
                  >
                    {size.label}
                  </button>
                )}
              </For>
            </div>

            <div class="layout-editor__zone-toolbar-group">
              <span class="group-label">Zone Ratio:</span>
              <select
                value={getZoneAspectLock(zone().id) || ''}
                onChange={(e) =>
                  setZoneAspectRatio(zone().id, e.currentTarget.value || null)
                }
                class="layout-editor__zone-aspect-select"
              >
                <option value="">None</option>
                <For each={ZONE_ASPECT_RATIOS}>
                  {(ratio) => <option value={ratio}>{ratio}</option>}
                </For>
              </select>
              <Show when={getZoneAspectLock(zone().id)}>
                <BsLock class="lock-icon" />
              </Show>
            </div>
          </div>
        )}
      </Show>

      {/* Canvas Area */}
      <div ref={canvasContainerRef} class="layout-editor__canvas-container">
        <div
          ref={canvasRef}
          class="layout-editor__canvas"
          style={{
            width: `${canvasSize().width}px`,
            height: `${canvasSize().height}px`,
          }}
          onClick={() => setSelectedZoneId(null)}
        >
          {/* Zones sorted by z-index */}
          <For
            each={[...props.value.zones].sort((a, b) => a.zIndex - b.zIndex)}
          >
            {(zone) => (
              <div
                class={`layout-editor__zone ${
                  selectedZoneId() === zone.id ? 'selected' : ''
                }`}
                style={{
                  left: `${zone.rect.x}%`,
                  top: `${zone.rect.y}%`,
                  width: `${zone.rect.width}%`,
                  height: `${zone.rect.height}%`,
                  'z-index': zone.zIndex,
                }}
                onMouseDown={(e) => handleZoneMouseDown(e, zone.id)}
                onClick={(e) => {
                  // Handle click for trackpad soft taps - select zone without drag
                  e.stopPropagation();
                  setSelectedZoneId(zone.id);
                }}
              >
                <div class="layout-editor__zone-label">{zone.name}</div>

                {/* Resize handles - only show for selected zone */}
                <Show when={selectedZoneId() === zone.id}>
                  <div
                    class="resize-handle nw"
                    onMouseDown={(e) => handleResizeMouseDown(e, zone.id, 'nw')}
                  />
                  <div
                    class="resize-handle n"
                    onMouseDown={(e) => handleResizeMouseDown(e, zone.id, 'n')}
                  />
                  <div
                    class="resize-handle ne"
                    onMouseDown={(e) => handleResizeMouseDown(e, zone.id, 'ne')}
                  />
                  <div
                    class="resize-handle e"
                    onMouseDown={(e) => handleResizeMouseDown(e, zone.id, 'e')}
                  />
                  <div
                    class="resize-handle se"
                    onMouseDown={(e) => handleResizeMouseDown(e, zone.id, 'se')}
                  />
                  <div
                    class="resize-handle s"
                    onMouseDown={(e) => handleResizeMouseDown(e, zone.id, 's')}
                  />
                  <div
                    class="resize-handle sw"
                    onMouseDown={(e) => handleResizeMouseDown(e, zone.id, 'sw')}
                  />
                  <div
                    class="resize-handle w"
                    onMouseDown={(e) => handleResizeMouseDown(e, zone.id, 'w')}
                  />
                </Show>
              </div>
            )}
          </For>
        </div>
      </div>

      {/* Zone Properties Panel */}
      <div class="layout-editor__properties">
        <Show
          when={selectedZone()}
          fallback={
            <div class="layout-editor__no-selection">
              Select a zone to edit its properties, or click "Add Zone" to
              create one.
            </div>
          }
        >
          {(zone) => (
            <div class="layout-editor__zone-properties">
              <h4>Zone Properties</h4>

              <FormItem
                label="Name"
                id="zone-name"
                type="text"
                value={zone().name}
                onInput={(value) =>
                  updateZone(zone().id, { name: String(value) })
                }
              >
                {null}
              </FormItem>

              <div class="layout-editor__position-inputs">
                <FormItem
                  label="X (%)"
                  id="zone-x"
                  type="number"
                  value={String(zone().rect.x)}
                  onInput={(value) =>
                    updateZone(zone().id, {
                      rect: { ...zone().rect, x: Number(value) },
                    })
                  }
                >
                  {null}
                </FormItem>
                <FormItem
                  label="Y (%)"
                  id="zone-y"
                  type="number"
                  value={String(zone().rect.y)}
                  onInput={(value) =>
                    updateZone(zone().id, {
                      rect: { ...zone().rect, y: Number(value) },
                    })
                  }
                >
                  {null}
                </FormItem>
                <FormItem
                  label="Width (%)"
                  id="zone-width"
                  type="number"
                  value={String(zone().rect.width)}
                  onInput={(value) =>
                    updateZone(zone().id, {
                      rect: { ...zone().rect, width: Number(value) },
                    })
                  }
                >
                  {null}
                </FormItem>
                <FormItem
                  label="Height (%)"
                  id="zone-height"
                  type="number"
                  value={String(zone().rect.height)}
                  onInput={(value) =>
                    updateZone(zone().id, {
                      rect: { ...zone().rect, height: Number(value) },
                    })
                  }
                >
                  {null}
                </FormItem>
              </div>

              <div class="layout-editor__zone-actions">
                <Button
                  onClick={() => moveZoneUp(zone().id)}
                  color="secondary"
                  icon={BsArrowUp}
                  title="Bring Forward"
                />
                <Button
                  onClick={() => moveZoneDown(zone().id)}
                  color="secondary"
                  icon={BsArrowDown}
                  title="Send Backward"
                />
                <Button
                  onClick={() => deleteZone(zone().id)}
                  color="danger"
                  icon={BsTrash}
                  title="Delete Zone"
                />
              </div>
            </div>
          )}
        </Show>
      </div>

      {/* Zones List */}
      <div class="layout-editor__zones-list">
        <h4>Zones ({props.value.zones.length})</h4>
        <For each={[...props.value.zones].sort((a, b) => b.zIndex - a.zIndex)}>
          {(zone) => (
            <div
              class={`layout-editor__zone-item ${
                selectedZoneId() === zone.id ? 'selected' : ''
              }`}
              onClick={() => setSelectedZoneId(zone.id)}
            >
              <span class="zone-name">{zone.name}</span>
              <span class="zone-z">z: {zone.zIndex}</span>
            </div>
          )}
        </For>
      </div>
    </div>
  );
};

export default LayoutEditor;
