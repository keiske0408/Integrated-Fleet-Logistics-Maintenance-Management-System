import type { FormValues } from './types';

export type RuleOperator = 'eq' | 'neq' | 'in' | 'not_in' | 'exists';

export interface RuleCondition {
  field: string;
  operator: RuleOperator;
  value?: string | number | boolean | Array<string | number>;
}

export interface FieldRule {
  when: RuleCondition;
  show?: boolean;
  required?: boolean;
  enabled?: boolean;
}

export function evaluateCondition(condition: RuleCondition, values: FormValues): boolean {
  const actual = values[condition.field];
  switch (condition.operator) {
    case 'eq':
      return actual === condition.value;
    case 'neq':
      return actual !== condition.value;
    case 'in':
      return Array.isArray(condition.value) && condition.value.includes(actual as string | number);
    case 'not_in':
      return Array.isArray(condition.value) && !condition.value.includes(actual as string | number);
    case 'exists':
      return actual !== undefined && actual !== '' && actual !== null;
  }
}

export function getFieldState(rules: FieldRule[] = [], values: FormValues) {
  return rules.reduce(
    (state, rule) => {
      if (!evaluateCondition(rule.when, values)) return state;
      return {
        visible: rule.show ?? state.visible,
        required: rule.required ?? state.required,
        enabled: rule.enabled ?? state.enabled,
      };
    },
    { visible: true, required: false, enabled: true },
  );
}
