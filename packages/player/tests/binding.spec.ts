import { expect } from 'chai';
import { describe, it } from 'mocha';
import {
  Binding,
  SwitchBinding,
  ConditionalBinding,
  ConcatBinding,
  TemplateConfig,
  isBinding,
  isSwitchBinding,
  isConditionalBinding,
  isConcatBinding,
  isAnyBinding,
  resolveKey,
  resolveBinding,
  resolveSwitchBinding,
  resolveConditionalBinding,
  resolveConcatBinding,
  resolveOption,
} from '../src/widgets/template/binding';

describe('Binding Type Guards', () => {
  describe('isBinding', () => {
    it('should return true for simple bindings', () => {
      expect(isBinding({ key: 'data.value' })).to.be.true;
      expect(isBinding({ key: 'options.title', default: 'Default' })).to.be
        .true;
    });

    it('should return false for switch bindings', () => {
      expect(isBinding({ switch: { key: 'data.type', cases: {} } })).to.be
        .false;
    });

    it('should return false for conditional bindings', () => {
      expect(
        isBinding({ cond: { key: 'data.value', gte: 0, then: 'a', else: 'b' } })
      ).to.be.false;
    });

    it('should return false for non-objects', () => {
      expect(isBinding('string')).to.be.false;
      expect(isBinding(123)).to.be.false;
      expect(isBinding(null)).to.be.false;
      expect(isBinding(undefined)).to.be.false;
    });

    it('should return false for objects without key', () => {
      expect(isBinding({ value: 'test' })).to.be.false;
      expect(isBinding({})).to.be.false;
    });
  });

  describe('isSwitchBinding', () => {
    it('should return true for switch bindings', () => {
      expect(isSwitchBinding({ switch: { key: 'data.type', cases: { a: 1 } } }))
        .to.be.true;
    });

    it('should return false for simple bindings', () => {
      expect(isSwitchBinding({ key: 'data.value' })).to.be.false;
    });

    it('should return false for non-objects', () => {
      expect(isSwitchBinding('string')).to.be.false;
      expect(isSwitchBinding(null)).to.be.false;
    });
  });

  describe('isConditionalBinding', () => {
    it('should return true for conditional bindings', () => {
      expect(
        isConditionalBinding({
          cond: { key: 'data.value', gte: 0, then: 'yes', else: 'no' },
        })
      ).to.be.true;
    });

    it('should return false for simple bindings', () => {
      expect(isConditionalBinding({ key: 'data.value' })).to.be.false;
    });

    it('should return false for non-objects', () => {
      expect(isConditionalBinding('string')).to.be.false;
      expect(isConditionalBinding(null)).to.be.false;
    });
  });

  describe('isConcatBinding', () => {
    it('should return true for concat bindings with array', () => {
      expect(isConcatBinding({ concat: ['a', 'b'] })).to.be.true;
      expect(isConcatBinding({ concat: [{ key: 'data.value' }, 'px'] })).to.be
        .true;
    });

    it('should return false for concat with non-array', () => {
      expect(isConcatBinding({ concat: 'string' })).to.be.false;
    });

    it('should return false for simple bindings', () => {
      expect(isConcatBinding({ key: 'data.value' })).to.be.false;
    });

    it('should return false for non-objects', () => {
      expect(isConcatBinding('string')).to.be.false;
      expect(isConcatBinding(null)).to.be.false;
    });
  });

  describe('isAnyBinding', () => {
    it('should return true for all binding types', () => {
      expect(isAnyBinding({ key: 'data.value' })).to.be.true;
      expect(isAnyBinding({ switch: { key: 'data.type', cases: {} } })).to.be
        .true;
      expect(
        isAnyBinding({
          cond: { key: 'data.value', gte: 0, then: 'a', else: 'b' },
        })
      ).to.be.true;
      expect(isAnyBinding({ concat: ['a', 'b'] })).to.be.true;
    });

    it('should return false for non-bindings', () => {
      expect(isAnyBinding('string')).to.be.false;
      expect(isAnyBinding(123)).to.be.false;
      expect(isAnyBinding(null)).to.be.false;
      expect(isAnyBinding({ value: 'test' })).to.be.false;
    });
  });
});

describe('resolveKey', () => {
  const config: TemplateConfig = {
    options: { title: 'My Title', count: 5 },
    data: { items: ['a', 'b', 'c'], nested: { value: 42 } },
  };

  it('should resolve options path', () => {
    const [result, error] = resolveKey('options.title', config, {}, {});
    expect(error).to.be.undefined;
    expect(result).to.equal('My Title');
  });

  it('should resolve data path', () => {
    const [result, error] = resolveKey('data.nested.value', config, {}, {});
    expect(error).to.be.undefined;
    expect(result).to.equal(42);
  });

  it('should resolve array index', () => {
    const [result, error] = resolveKey('data.items[1]', config, {}, {});
    expect(error).to.be.undefined;
    expect(result).to.equal('b');
  });

  it('should resolve context path with $. prefix', () => {
    const context = { name: 'Test', value: 100 };
    const [result, error] = resolveKey('$.name', config, context, {});
    expect(error).to.be.undefined;
    expect(result).to.equal('Test');
  });

  it('should resolve with globals', () => {
    const [result, error] = resolveKey(
      'data.items[@index]',
      config,
      {},
      { index: 2 }
    );
    expect(error).to.be.undefined;
    expect(result).to.equal('c');
  });
});

describe('resolveBinding', () => {
  const config: TemplateConfig = {
    options: { title: 'Hello', fontSize: 16 },
    data: { message: 'World', count: 42 },
  };

  it('should resolve binding to value', () => {
    const binding: Binding<string> = { key: 'options.title' };
    const result = resolveBinding(binding, config, {}, {});
    expect(result).to.equal('Hello');
  });

  it('should return default when key not found', () => {
    const binding: Binding<string> = {
      key: 'options.nonexistent',
      default: 'Default Value',
    };
    const result = resolveBinding(binding, config, {}, {});
    expect(result).to.equal('Default Value');
  });

  it('should resolve numeric values', () => {
    const binding: Binding<number> = { key: 'data.count' };
    const result = resolveBinding(binding, config, {}, {});
    expect(result).to.equal(42);
  });

  it('should resolve context bindings', () => {
    const binding: Binding<string> = { key: '$.item' };
    const context = { item: 'Current Item' };
    const result = resolveBinding(binding, config, context, {});
    expect(result).to.equal('Current Item');
  });
});

describe('resolveSwitchBinding', () => {
  const config: TemplateConfig = {
    options: {},
    data: { status: 'success', direction: 'up' },
  };

  it('should resolve matching case', () => {
    const binding: SwitchBinding<string> = {
      switch: {
        key: 'data.status',
        cases: {
          success: '#00C853',
          error: '#FF1744',
          default: '#9E9E9E',
        },
      },
    };
    const result = resolveSwitchBinding(binding, config, {}, {});
    expect(result).to.equal('#00C853');
  });

  it('should resolve default case when no match', () => {
    const binding: SwitchBinding<string> = {
      switch: {
        key: 'data.status',
        cases: {
          pending: '#FFC107',
          default: '#9E9E9E',
        },
      },
    };
    const result = resolveSwitchBinding(binding, config, {}, {});
    expect(result).to.equal('#9E9E9E');
  });

  it('should return undefined when no match and no default', () => {
    const binding: SwitchBinding<string> = {
      switch: {
        key: 'data.status',
        cases: {
          pending: '#FFC107',
        },
      },
    };
    const result = resolveSwitchBinding(binding, config, {}, {});
    expect(result).to.be.undefined;
  });

  it('should resolve nested bindings in cases', () => {
    const configWithColors: TemplateConfig = {
      options: { successColor: '#00FF00' },
      data: { status: 'success' },
    };
    const binding: SwitchBinding = {
      switch: {
        key: 'data.status',
        cases: {
          success: { key: 'options.successColor' },
          default: '#CCCCCC',
        },
      },
    };
    const result = resolveSwitchBinding(binding, configWithColors, {}, {});
    expect(result).to.equal('#00FF00');
  });

  it('should use default when key cannot be resolved', () => {
    const binding: SwitchBinding<string> = {
      switch: {
        key: 'data.nonexistent',
        cases: {
          value: '#000000',
          default: '#FFFFFF',
        },
      },
    };
    const result = resolveSwitchBinding(binding, config, {}, {});
    expect(result).to.equal('#FFFFFF');
  });

  it('should resolve context values', () => {
    const binding: SwitchBinding<string> = {
      switch: {
        key: '$.direction',
        cases: {
          up: '↑',
          down: '↓',
          default: '→',
        },
      },
    };
    const context = { direction: 'up' };
    const result = resolveSwitchBinding(binding, config, context, {});
    expect(result).to.equal('↑');
  });
});

describe('resolveConditionalBinding', () => {
  const config: TemplateConfig = {
    options: {},
    data: { value: 10, negative: -5, zero: 0 },
  };

  describe('gte operator', () => {
    it('should return then value when value >= threshold', () => {
      const binding: ConditionalBinding<string> = {
        cond: { key: 'data.value', gte: 5, then: 'high', else: 'low' },
      };
      expect(resolveConditionalBinding(binding, config, {}, {})).to.equal(
        'high'
      );
    });

    it('should return then value when value equals threshold', () => {
      const binding: ConditionalBinding<string> = {
        cond: {
          key: 'data.zero',
          gte: 0,
          then: 'non-negative',
          else: 'negative',
        },
      };
      expect(resolveConditionalBinding(binding, config, {}, {})).to.equal(
        'non-negative'
      );
    });

    it('should return else value when value < threshold', () => {
      const binding: ConditionalBinding<string> = {
        cond: {
          key: 'data.negative',
          gte: 0,
          then: 'positive',
          else: 'negative',
        },
      };
      expect(resolveConditionalBinding(binding, config, {}, {})).to.equal(
        'negative'
      );
    });
  });

  describe('gt operator', () => {
    it('should return then value when value > threshold', () => {
      const binding: ConditionalBinding<string> = {
        cond: {
          key: 'data.value',
          gt: 5,
          then: 'greater',
          else: 'not greater',
        },
      };
      expect(resolveConditionalBinding(binding, config, {}, {})).to.equal(
        'greater'
      );
    });

    it('should return else value when value equals threshold', () => {
      const binding: ConditionalBinding<string> = {
        cond: {
          key: 'data.zero',
          gt: 0,
          then: 'positive',
          else: 'not positive',
        },
      };
      expect(resolveConditionalBinding(binding, config, {}, {})).to.equal(
        'not positive'
      );
    });
  });

  describe('lte operator', () => {
    it('should return then value when value <= threshold', () => {
      const binding: ConditionalBinding<string> = {
        cond: {
          key: 'data.negative',
          lte: 0,
          then: 'non-positive',
          else: 'positive',
        },
      };
      expect(resolveConditionalBinding(binding, config, {}, {})).to.equal(
        'non-positive'
      );
    });

    it('should return else value when value > threshold', () => {
      const binding: ConditionalBinding<string> = {
        cond: { key: 'data.value', lte: 5, then: 'low', else: 'high' },
      };
      expect(resolveConditionalBinding(binding, config, {}, {})).to.equal(
        'high'
      );
    });
  });

  describe('lt operator', () => {
    it('should return then value when value < threshold', () => {
      const binding: ConditionalBinding<string> = {
        cond: {
          key: 'data.negative',
          lt: 0,
          then: 'negative',
          else: 'non-negative',
        },
      };
      expect(resolveConditionalBinding(binding, config, {}, {})).to.equal(
        'negative'
      );
    });
  });

  describe('eq operator', () => {
    it('should return then value when value equals', () => {
      const binding: ConditionalBinding<string> = {
        cond: { key: 'data.zero', eq: 0, then: 'zero', else: 'not zero' },
      };
      expect(resolveConditionalBinding(binding, config, {}, {})).to.equal(
        'zero'
      );
    });

    it('should return else value when value does not equal', () => {
      const binding: ConditionalBinding<string> = {
        cond: { key: 'data.value', eq: 0, then: 'zero', else: 'not zero' },
      };
      expect(resolveConditionalBinding(binding, config, {}, {})).to.equal(
        'not zero'
      );
    });
  });

  describe('neq operator', () => {
    it('should return then value when value does not equal', () => {
      const binding: ConditionalBinding<string> = {
        cond: { key: 'data.value', neq: 0, then: 'not zero', else: 'zero' },
      };
      expect(resolveConditionalBinding(binding, config, {}, {})).to.equal(
        'not zero'
      );
    });

    it('should return else value when value equals', () => {
      const binding: ConditionalBinding<string> = {
        cond: { key: 'data.zero', neq: 0, then: 'not zero', else: 'zero' },
      };
      expect(resolveConditionalBinding(binding, config, {}, {})).to.equal(
        'zero'
      );
    });
  });

  it('should resolve nested bindings in then/else', () => {
    const configWithColors: TemplateConfig = {
      options: { positiveColor: '#00FF00', negativeColor: '#FF0000' },
      data: { value: 10 },
    };
    const binding: ConditionalBinding = {
      cond: {
        key: 'data.value',
        gte: 0,
        then: { key: 'options.positiveColor' },
        else: { key: 'options.negativeColor' },
      },
    };
    const result = resolveConditionalBinding(binding, configWithColors, {}, {});
    expect(result).to.equal('#00FF00');
  });

  it('should return else when key cannot be resolved', () => {
    const binding: ConditionalBinding<string> = {
      cond: { key: 'data.nonexistent', gte: 0, then: 'yes', else: 'no' },
    };
    expect(resolveConditionalBinding(binding, config, {}, {})).to.equal('no');
  });

  it('should resolve context values', () => {
    const binding: ConditionalBinding<string> = {
      cond: { key: '$.change', gte: 0, then: 'positive', else: 'negative' },
    };
    const context = { change: 5.5 };
    expect(resolveConditionalBinding(binding, config, context, {})).to.equal(
      'positive'
    );
  });
});

describe('resolveConcatBinding', () => {
  const config: TemplateConfig = {
    options: { height: 10, width: 20 },
    data: { prefix: 'item', index: 5 },
  };

  it('should concatenate literal strings', () => {
    const binding: ConcatBinding = { concat: ['Hello', ' ', 'World'] };
    const result = resolveConcatBinding(binding, config, {}, {});
    expect(result).to.equal('Hello World');
  });

  it('should concatenate binding with unit', () => {
    const binding: ConcatBinding = {
      concat: [{ key: 'options.height' }, 'vh'],
    };
    const result = resolveConcatBinding(binding, config, {}, {});
    expect(result).to.equal('10vh');
  });

  it('should concatenate multiple bindings', () => {
    const binding: ConcatBinding = {
      concat: [{ key: 'data.prefix' }, '-', { key: 'data.index' }],
    };
    const result = resolveConcatBinding(binding, config, {}, {});
    expect(result).to.equal('item-5');
  });

  it('should use default values for missing keys', () => {
    const binding: ConcatBinding = {
      concat: [{ key: 'options.nonexistent', default: 5 }, 'px'],
    };
    const result = resolveConcatBinding(binding, config, {}, {});
    expect(result).to.equal('5px');
  });

  it('should handle empty values as empty strings', () => {
    const binding: ConcatBinding = {
      concat: [{ key: 'options.nonexistent' }, 'px'],
    };
    const result = resolveConcatBinding(binding, config, {}, {});
    expect(result).to.equal('px');
  });

  it('should concatenate numbers correctly', () => {
    const binding: ConcatBinding = { concat: [100, '%'] };
    const result = resolveConcatBinding(binding, config, {}, {});
    expect(result).to.equal('100%');
  });

  it('should resolve context values', () => {
    const binding: ConcatBinding = { concat: [{ key: '$.value' }, 'em'] };
    const context = { value: 2.5 };
    const result = resolveConcatBinding(binding, config, context, {});
    expect(result).to.equal('2.5em');
  });

  it('should handle nested concat with other binding types', () => {
    // Use 'as any' to bypass strict typing for nested bindings in tests
    const binding = {
      concat: [
        {
          cond: {
            key: 'options.height',
            gte: 10,
            then: 'large',
            else: 'small',
          },
        },
        '-box',
      ],
    } as ConcatBinding;
    const result = resolveConcatBinding(binding, config, {}, {});
    expect(result).to.equal('large-box');
  });
});

describe('resolveOption', () => {
  const config: TemplateConfig = {
    options: { title: 'Test', size: 16 },
    data: { status: 'active', value: 10 },
  };

  it('should return literal values unchanged', () => {
    expect(resolveOption('string', config, {}, {})).to.equal('string');
    expect(resolveOption(42, config, {}, {})).to.equal(42);
    expect(resolveOption(true, config, {}, {})).to.equal(true);
    expect(resolveOption(null, config, {}, {})).to.equal(null);
  });

  it('should resolve simple bindings', () => {
    const result = resolveOption({ key: 'options.title' }, config, {}, {});
    expect(result).to.equal('Test');
  });

  it('should resolve switch bindings', () => {
    const binding = {
      switch: {
        key: 'data.status',
        cases: { active: 'green', inactive: 'gray' },
      },
    };
    const result = resolveOption(binding, config, {}, {});
    expect(result).to.equal('green');
  });

  it('should resolve conditional bindings', () => {
    const binding = {
      cond: { key: 'data.value', gte: 5, then: 'high', else: 'low' },
    };
    const result = resolveOption(binding, config, {}, {});
    expect(result).to.equal('high');
  });

  it('should resolve concat bindings', () => {
    const binding = { concat: [{ key: 'options.size' }, 'px'] };
    const result = resolveOption(binding, config, {}, {});
    expect(result).to.equal('16px');
  });

  it('should handle complex nested bindings', () => {
    const configWithAll: TemplateConfig = {
      options: { positiveColor: '#00FF00', negativeColor: '#FF0000' },
      data: { change: 5.5 },
    };
    // A concat that includes a conditional
    const binding = {
      concat: [
        'color: ',
        {
          cond: {
            key: 'data.change',
            gte: 0,
            then: { key: 'options.positiveColor' },
            else: { key: 'options.negativeColor' },
          },
        },
      ],
    };
    const result = resolveOption(binding, configWithAll, {}, {});
    expect(result).to.equal('color: #00FF00');
  });
});

describe('Integration: Stock Ticker Use Cases', () => {
  // Simulating real-world stock ticker widget scenarios
  const stockConfig: TemplateConfig = {
    options: {
      ticker_height: 8,
      item_gap: 3,
      positive_color: '#00C853',
      negative_color: '#FF1744',
      neutral_color: '#9E9E9E',
    },
    data: {
      quotes: [
        { symbol: 'AAPL', price: 150.25, change: 2.5, direction: 'up' },
        { symbol: 'GOOGL', price: 2800.0, change: -15.0, direction: 'down' },
        { symbol: 'TSLA', price: 250.0, change: 0, direction: 'neutral' },
      ],
    },
  };

  it('should resolve font-size with viewport height units', () => {
    const binding = { concat: [{ key: 'options.ticker_height' }, 'vh'] };
    const result = resolveOption(binding, stockConfig, {}, {});
    expect(result).to.equal('8vh');
  });

  it('should resolve gap with em units (relative to font-size)', () => {
    const binding = { concat: [{ key: 'options.item_gap' }, 'em'] };
    const result = resolveOption(binding, stockConfig, {}, {});
    expect(result).to.equal('3em');
  });

  it('should resolve direction-based color using switch', () => {
    const binding = {
      switch: {
        key: '$.direction',
        cases: {
          up: { key: 'options.positive_color' },
          down: { key: 'options.negative_color' },
          default: { key: 'options.neutral_color' },
        },
      },
    };

    // Test with 'up' direction
    const upResult = resolveOption(
      binding,
      stockConfig,
      stockConfig.data.quotes[0],
      {}
    );
    expect(upResult).to.equal('#00C853');

    // Test with 'down' direction
    const downResult = resolveOption(
      binding,
      stockConfig,
      stockConfig.data.quotes[1],
      {}
    );
    expect(downResult).to.equal('#FF1744');

    // Test with 'neutral' direction (falls to default)
    const neutralResult = resolveOption(
      binding,
      stockConfig,
      stockConfig.data.quotes[2],
      {}
    );
    expect(neutralResult).to.equal('#9E9E9E');
  });

  it('should resolve change-based color using conditional', () => {
    const binding = {
      cond: {
        key: '$.change',
        gte: 0,
        then: { key: 'options.positive_color' },
        else: { key: 'options.negative_color' },
      },
    };

    // Positive change
    const positiveResult = resolveOption(
      binding,
      stockConfig,
      stockConfig.data.quotes[0],
      {}
    );
    expect(positiveResult).to.equal('#00C853');

    // Negative change
    const negativeResult = resolveOption(
      binding,
      stockConfig,
      stockConfig.data.quotes[1],
      {}
    );
    expect(negativeResult).to.equal('#FF1744');

    // Zero change (should be positive/non-negative)
    const zeroResult = resolveOption(
      binding,
      stockConfig,
      stockConfig.data.quotes[2],
      {}
    );
    expect(zeroResult).to.equal('#00C853');
  });

  it('should handle default values for missing options', () => {
    const emptyConfig: TemplateConfig = { options: {}, data: {} };
    const binding = {
      concat: [{ key: 'options.ticker_height', default: 5 }, 'vh'],
    };
    const result = resolveOption(binding, emptyConfig, {}, {});
    expect(result).to.equal('5vh');
  });
});
