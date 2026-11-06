import type { Component } from 'solid-js';
import type { IconTypes } from 'solid-icons';

export type TranslateFn = (
  key: string,
  params?: Record<string, string | number>
) => string;

/** Context passed to summary functions. */
export interface SummaryContext {
  t: TranslateFn;
  locale: string;
  /** Resolves a playlist name from the client-side cache, if known. */
  playlistName: (id: number) => string | undefined;
}

/** Props received by every registered source or action editor. */
export interface TypeEditorProps<C> {
  config: C;
  onChange: (config: C) => void;
  organizationId: string;
  /** Translation keys of the current validation errors. */
  errors: string[];
}

interface TypeDefinition<C> {
  type: string;
  icon: IconTypes;
  label: (t: TranslateFn) => string;
  description: (t: TranslateFn) => string;
  defaultConfig: () => C;
  editor: Component<TypeEditorProps<C>>;
  summary: (config: C, ctx: SummaryContext) => string;
  /** Returns translation keys for the validation errors (empty = valid). */
  validate: (config: C) => string[];
  /** Normalizes the config before saving (e.g. strips unused fields). */
  normalize?: (config: C) => C;
}

/** An event source ("when" side of a rule). */
export interface SourceDefinition<C = any> extends TypeDefinition<C> {
  /** Condition name stored in `when.condition`. */
  condition: string;
}

/** An action ("then" side of a rule). */
export type ActionDefinition<C = any> = TypeDefinition<C>;
