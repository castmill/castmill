// Automation rules use the contract's `when`/`then` keys.
/* oxlint-disable unicorn/no-thenable */
/**
 * Automation type registry.
 *
 * Every event source ("when") and action ("then") registers its editor
 * component, plain-language summary, default config and validator here.
 * The automations page and the rule drawer only look types up in this
 * registry, so adding a type requires nothing but a `registerSource` or
 * `registerAction` call (plus the server and device implementations, see
 * agents/systems/AUTOMATIONS.md).
 */
import type { Component } from 'solid-js';

import type { AutomationRule } from '../../services/automations.service';
import type {
  ActionDefinition,
  SourceDefinition,
  SummaryContext,
  TypeEditorProps,
} from './registry-types';
import { clockSource } from './sources/clock';
import { interruptAction } from './actions/interrupt';

export type {
  ActionDefinition,
  SourceDefinition,
  SummaryContext,
  TypeEditorProps,
  TranslateFn,
} from './registry-types';

type Summary = (config: any, ctx: SummaryContext) => string;

export const sources: Record<string, SourceDefinition> = {};
export const actions: Record<string, ActionDefinition> = {};

export const sourceEditors: Record<
  string,
  Component<TypeEditorProps<any>>
> = {};
export const actionEditors: Record<
  string,
  Component<TypeEditorProps<any>>
> = {};
export const sourceSummaries: Record<string, Summary> = {};
export const actionSummaries: Record<string, Summary> = {};
export const sourceDefaults: Record<string, () => unknown> = {};
export const actionDefaults: Record<string, () => unknown> = {};

export const registerSource = <C,>(definition: SourceDefinition<C>) => {
  sources[definition.type] = definition;
  sourceEditors[definition.type] = definition.editor;
  sourceSummaries[definition.type] = definition.summary;
  sourceDefaults[definition.type] = definition.defaultConfig;
};

export const registerAction = <C,>(definition: ActionDefinition<C>) => {
  actions[definition.type] = definition;
  actionEditors[definition.type] = definition.editor;
  actionSummaries[definition.type] = definition.summary;
  actionDefaults[definition.type] = definition.defaultConfig;
};

export const unregisterSource = (type: string) => {
  delete sources[type];
  delete sourceEditors[type];
  delete sourceSummaries[type];
  delete sourceDefaults[type];
};

export const unregisterAction = (type: string) => {
  delete actions[type];
  delete actionEditors[type];
  delete actionSummaries[type];
  delete actionDefaults[type];
};

export const getSource = (type: string): SourceDefinition | undefined =>
  sources[type];
export const getAction = (type: string): ActionDefinition | undefined =>
  actions[type];

/**
 * Registered types, restricted to those the server supports when its
 * registry is known (`null` = unknown, show every registered type).
 */
export const availableSources = (serverTypes: string[] | null) =>
  Object.values(sources).filter(
    (source) => !serverTypes || serverTypes.includes(source.type)
  );

export const availableActions = (serverTypes: string[] | null) =>
  Object.values(actions).filter(
    (action) => !serverTypes || serverTypes.includes(action.type)
  );

export const whenSummary = (rule: AutomationRule, ctx: SummaryContext) => {
  const summary = sourceSummaries[rule.when?.source];
  return summary
    ? summary(rule.when.config, ctx)
    : ctx.t('automations.summary.unknownType', {
        type: String(rule.when?.source),
      });
};

export const thenSummary = (rule: AutomationRule, ctx: SummaryContext) => {
  const summary = actionSummaries[rule.then?.action];
  return summary
    ? summary(rule.then.config, ctx)
    : ctx.t('automations.summary.unknownType', {
        type: String(rule.then?.action),
      });
};

/** Full plain-language summary: "When … → Then …". */
export const ruleSummary = (rule: AutomationRule, ctx: SummaryContext) =>
  `${whenSummary(rule, ctx)} → ${thenSummary(rule, ctx)}`;

/** Validates a whole rule with the registered validators. */
export const validateRule = (rule: AutomationRule): string[] => {
  const source = sources[rule.when?.source];
  const action = actions[rule.then?.action];
  const errors = [
    ...(source
      ? source.validate(rule.when.config)
      : ['automations.validation.source']),
    ...(action
      ? action.validate(rule.then.config)
      : ['automations.validation.action']),
  ];
  if (!Number.isInteger(rule.cooldown_seconds) || rule.cooldown_seconds < 0)
    errors.push('automations.validation.cooldown');
  return errors;
};

/** Applies the registered normalizers before sending a rule to the server. */
export const normalizeRule = (rule: AutomationRule): AutomationRule => {
  const source = sources[rule.when.source];
  const action = actions[rule.then.action];
  return {
    ...rule,
    when: {
      ...rule.when,
      config: source?.normalize
        ? source.normalize(rule.when.config)
        : rule.when.config,
    },
    then: {
      ...rule.then,
      config: action?.normalize
        ? action.normalize(rule.then.config)
        : rule.then.config,
    },
  };
};

/** A new rule using the given (or first available) source and action. */
export const newRule = (
  sourceType = Object.keys(sources)[0],
  actionType = Object.keys(actions)[0]
): AutomationRule => {
  const source = sources[sourceType];
  const action = actions[actionType];
  return {
    when: {
      source: sourceType,
      condition: source?.conditions[0] ?? '',
      config: source ? source.defaultConfig() : {},
    },
    then: {
      action: actionType,
      config: action ? action.defaultConfig() : {},
    },
    cooldown_seconds: 0,
  };
};

registerSource(clockSource);
registerAction(interruptAction);
