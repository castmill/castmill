import { expect } from 'chai';
import { describe, it } from 'mocha';
// @ts-ignore Node built-ins have no type declarations in this package.
import { readFileSync } from 'fs';
// @ts-ignore jsdom is hoisted from other workspaces without type declarations.
import { JSDOM } from 'jsdom';
import { firstValueFrom } from 'rxjs';

import {
  FORMATTERS,
  formatDate,
  formatNumber,
  localeData,
  parseDate,
  parseFmt,
  resolveLocale,
  resolveOption,
  TemplateWidget,
  tickClock,
} from '../dist/index.js';

const fixtures = JSON.parse(
  readFileSync(new URL('./fixtures/fmt-grammar.json', import.meta.url), 'utf8')
);

const NBSP = '\u00a0';
const config = (data: any = {}, options: any = {}) => ({ options, data });
const resolve = (
  option: any,
  data: any = {},
  globals: any = { locale: 'sv' },
  options: any = {}
) => resolveOption(option, config(data, options), {}, globals);

// Wall-clock local times, as listing systems send them (no offset).
const local = (y: number, m: number, d: number, h = 0, min = 0) =>
  new Date(y, m - 1, d, h, min);
const iso = (date: Date) => {
  const p = (n: number) => (n < 10 ? '0' : '') + n;
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}:00`;
};

describe('Template formatting', () => {
  describe('fmt grammar (shared fixtures with the server validator)', () => {
    it('parses every valid fixture', () => {
      for (const fmt of fixtures.valid) {
        expect(() => parseFmt(fmt), fmt).not.to.throw();
      }
    });

    it('rejects every invalid fixture', () => {
      for (const fmt of fixtures.invalid) {
        expect(() => parseFmt(fmt), fmt).to.throw();
      }
    });

    it('splits literals, paths, formatters and quoted arguments', () => {
      expect(parseFmt("{{a}} {data.x | date:'D/M | HH':sv} kr")).to.deep.equal([
        { literal: '{a} ' },
        {
          path: 'data.x',
          formatters: [{ name: 'date', args: ['D/M | HH', 'sv'] }],
        },
        { literal: ' kr' },
      ]);
      expect(parseFmt("{x | default:'it''s'}")[0]).to.deep.equal({
        path: 'x',
        formatters: [{ name: 'default', args: ["it's"] }],
      });
    });
  });

  describe('parseDate', () => {
    it('reads values without an offset as local wall-clock time', () => {
      expect(parseDate('2026-11-12T17:00')!.getTime()).to.equal(
        local(2026, 11, 12, 17).getTime()
      );
      expect(parseDate('2026-11-12 17:05:30.250')!.getTime()).to.equal(
        new Date(2026, 10, 12, 17, 5, 30, 250).getTime()
      );
      expect(parseDate('2026-11-12')!.getTime()).to.equal(
        local(2026, 11, 12).getTime()
      );
    });

    it('converts values with an offset', () => {
      expect(parseDate('2026-11-12T17:00:00Z')!.getTime()).to.equal(
        Date.UTC(2026, 10, 12, 17)
      );
      expect(parseDate('2026-11-12T17:00:00+01:00')!.getTime()).to.equal(
        Date.UTC(2026, 10, 12, 16)
      );
      expect(parseDate('2026-11-12T17:00-0130')!.getTime()).to.equal(
        Date.UTC(2026, 10, 12, 18, 30)
      );
    });

    it('accepts dates and epoch milliseconds, and rejects anything else', () => {
      const date = local(2026, 1, 2);
      expect(parseDate(date)).to.equal(date);
      expect(parseDate(date.getTime())!.getTime()).to.equal(date.getTime());
      for (const bad of [
        'tomorrow',
        '2026-13-01',
        '2026-11-12T25:00',
        null,
        undefined,
        NaN,
        {},
        new Date('x'),
      ]) {
        expect(parseDate(bad), String(bad)).to.equal(undefined);
      }
    });
  });

  describe('formatDate', () => {
    const date = local(2026, 11, 6, 14, 5);

    it('formats every token', () => {
      expect(
        formatDate(
          date,
          'YYYY YY M MM MMM MMMM D DD d ddd dddd H HH h hh m mm A',
          localeData('en')
        )
      ).to.equal(
        '2026 26 11 11 Nov November 6 06 5 Fri Friday 14 14 2 02 5 05 PM'
      );
      expect(
        formatDate(local(2026, 1, 1, 0), 'h A', localeData('en'))
      ).to.equal('12 AM');
    });

    it('keeps bracketed text literal and uses locale names', () => {
      expect(
        formatDate(date, 'dddd D MMMM [kl.] HH', localeData('sv'))
      ).to.equal('fredag 6 november kl. 14');
      expect(formatDate(date, 'ddd D MMM', localeData('de'))).to.equal(
        'Fr 6 Nov'
      );
      expect(formatDate(date, 'dddd', localeData('ja'))).to.equal('金曜日');
    });

    it('handles long unmatched brackets and still formats following tokens', () => {
      const unmatchedBrackets = '['.repeat(10000);
      expect(formatDate(date, unmatchedBrackets, localeData('en'))).to.equal(
        unmatchedBrackets
      );
      expect(formatDate(date, '[YYYY', localeData('en'))).to.equal('[2026');
    });
  });

  describe('formatNumber', () => {
    it('groups digits and keeps or rounds decimals', () => {
      expect(formatNumber(4950000, 'auto', ' ', ',')).to.equal('4 950 000');
      expect(formatNumber('4950000', 'auto', '.', ',')).to.equal('4.950.000');
      expect(formatNumber(3.5, 'auto', ' ', ',')).to.equal('3,5');
      expect(formatNumber(1234.567, 2, ',', '.')).to.equal('1,234.57');
      expect(formatNumber(-1234, 0, ' ', ',')).to.equal('-1 234');
      expect(formatNumber(-0.4, 0, ' ', ',')).to.equal('0');
      expect(formatNumber(0.0000001, 'auto', ' ', ',')).to.equal('0,0000001');
    });

    it('passes non-numeric text through and empties missing values', () => {
      expect(formatNumber('3-4', 'auto', ' ', ',')).to.equal('3-4');
      for (const empty of ['', ' ', null, undefined, Infinity, {}]) {
        expect(formatNumber(empty, 'auto', ' ', ',')).to.equal(undefined);
      }
    });
  });

  describe('locales', () => {
    it('resolves regional and unknown codes', () => {
      expect(resolveLocale('sv-SE')).to.equal('sv');
      expect(resolveLocale('PT_br')).to.equal('en');
      expect(resolveLocale(undefined)).to.equal('en');
      expect(resolveLocale('hasOwnProperty')).to.equal('en');
    });

    it('bundles complete tables for the nine dashboard languages', () => {
      for (const code of [
        'en',
        'es',
        'sv',
        'de',
        'fr',
        'zh',
        'ar',
        'ko',
        'ja',
      ]) {
        const data = localeData(code);
        expect(data.months, code).to.have.length(12);
        expect(data.monthsShort, code).to.have.length(12);
        expect(data.weekdays, code).to.have.length(7);
        expect(data.weekdaysShort, code).to.have.length(7);
      }
      expect(localeData('sv').group).to.equal(NBSP);
      expect(localeData('fr').group).to.equal(NBSP);
    });
  });

  describe('fmt binding', () => {
    const listing = {
      price: 4950000,
      rooms: 3.5,
      fee: null,
      street: '  Björkstigen 4 ',
      start: '2026-11-12T17:00:00',
    };

    it('formats values with the organization locale', () => {
      expect(resolve({ fmt: '{data.price | number} kr' }, listing)).to.equal(
        `4${NBSP}950${NBSP}000 kr`
      );
      expect(resolve({ fmt: '{data.rooms | number} ROK' }, listing)).to.equal(
        '3,5 ROK'
      );
      expect(
        resolve({ fmt: '{data.price | number} kr' }, listing, { locale: 'en' })
      ).to.equal('4,950,000 kr');
    });

    it('prefers the template locale option, then falls back to English', () => {
      const fmt = { fmt: "{data.start | date:'dddd'}" };
      expect(
        resolve(fmt, listing, { locale: 'sv' }, { locale: 'de' })
      ).to.equal('Donnerstag');
      expect(resolve(fmt, listing, {})).to.equal('Thursday');
      expect(
        resolve({ fmt: "{data.start | date:'dddd':fr}" }, listing)
      ).to.equal('jeudi');
    });

    it('empties the whole text when a placeholder is empty', () => {
      expect(resolve({ fmt: '{data.fee | number} kr/mån' }, listing)).to.equal(
        ''
      );
      expect(resolve({ fmt: '{data.missing} x' }, listing)).to.equal('');
      expect(
        resolve({ fmt: '{data.street | trim | upper}' }, listing)
      ).to.equal('BJÖRKSTIGEN 4');
      expect(
        resolve({ fmt: "{data.fee | default:'ENLIGT ÖK'}" }, listing)
      ).to.equal('ENLIGT ÖK');
    });

    it('applies the text formatters', () => {
      const apply = (name: string, value: any, ...args: string[]) =>
        FORMATTERS[name].apply(value, args, { locale: 'sv' });
      expect(apply('lower', 'ÅÄÖ')).to.equal('åäö');
      expect(apply('capitalize', 'måndag')).to.equal('Måndag');
      expect(apply('truncate', 'Strindbergsgatan 54', '8')).to.equal(
        'Strindbe…'
      );
      expect(apply('truncate', 'Kort', '8')).to.equal('Kort');
      expect(apply('truncate', 'Two words', '4')).to.equal('Two…');
      expect(apply('upper', '')).to.equal(undefined);
      expect(apply('number', 12, 'x')).to.equal(undefined);
      expect(apply('date', 'not a date', 'D')).to.equal(undefined);
    });

    it('returns an empty text for invalid fmt instead of failing', () => {
      const warn = console.warn;
      const warnings: string[] = [];
      console.warn = (message: string) => warnings.push(message);
      try {
        expect(resolve({ fmt: '{data.price | money}' }, listing)).to.equal('');
      } finally {
        console.warn = warn;
      }
      expect(warnings[0]).to.contain('money');
    });
  });

  describe('first binding', () => {
    it('returns the first value that is not empty', () => {
      const price = {
        first: [
          { key: 'options.overrides.price' },
          { fmt: '{data.price | number} kr' },
          'PÅ BEGÄRAN',
        ],
      };
      expect(resolve(price, { price: 100 })).to.equal('100 kr');
      expect(resolve(price, {})).to.equal('PÅ BEGÄRAN');
      expect(
        resolve(
          price,
          { price: 100 },
          { locale: 'sv' },
          { overrides: { price: 'Bud' } }
        )
      ).to.equal('Bud');
      expect(resolve({ first: [{ key: 'data.none' }, []] }, {})).to.equal(
        undefined
      );
    });
  });

  describe('list binding', () => {
    const now = Date.now();
    const at = (hours: number) => iso(new Date(now + hours * 3600000));
    const viewings = [
      { start: at(48), end: at(49) },
      { start: at(-3), end: at(-2) },
      { start: at(24), end: at(25) },
      { start: at(72), end: at(73) },
    ];

    it('filters with @now, sorts, maps, limits and joins', () => {
      const result = resolve(
        {
          list: {
            key: 'data.viewings',
            where: [{ key: '$.end', gte: '@now' }],
            sort: '$.start',
            limit: 2,
            item: { fmt: "{$.start | date:'D/M HH'}" },
            join: ', ',
          },
        },
        { viewings }
      );
      const expected = [viewings[2], viewings[0]]
        .map((v) => formatDate(parseDate(v.start)!, 'D/M HH', localeData('sv')))
        .join(', ');
      expect(result).to.equal(expected);
    });

    it('returns arrays, sorts descending and keeps equal keys in order', () => {
      const rows = [
        { id: 'a', rank: 1 },
        { id: 'b', rank: 2 },
        { id: 'c', rank: 1 },
        { id: 'd', rank: 2 },
      ];
      expect(
        resolve(
          {
            list: {
              key: 'data.rows',
              sort: '$.rank',
              desc: true,
              item: { key: '$.id' },
            },
          },
          { rows }
        )
      ).to.deep.equal(['b', 'd', 'a', 'c']);
      expect(resolve({ list: { key: 'data.missing' } }, {})).to.deep.equal([]);
      expect(
        resolve(
          { list: { key: 'data.tags', item: { fmt: '{$ | upper}' } } },
          { tags: ['a', '', 'b'] }
        )
      ).to.deep.equal(['A', 'B']);
    });

    it('builds facts from items, dropping empty ones before the limit', () => {
      const facts = {
        list: {
          items: [
            {
              label: 'Utgångspris:',
              value: { fmt: '{data.price | number} kr' },
            },
            {
              label: 'Månadsavgift:',
              value: { fmt: '{data.fee | number} kr/mån' },
            },
            { label: 'Antal rum:', value: { fmt: '{data.rooms} ROK' } },
            { label: 'Byggår:', value: { fmt: '{data.year}' } },
          ],
          where: [{ key: '$.value', present: true }],
          limit: 2,
        },
      };
      expect(
        resolve(facts, { price: 2000000, rooms: 3, year: 1929 })
      ).to.deep.equal([
        { label: 'Utgångspris:', value: `2${NBSP}000${NBSP}000 kr` },
        { label: 'Antal rum:', value: '3 ROK' },
      ]);
    });

    it('skips the first results before the limit', () => {
      const images = ['a', '', 'b', 'c', 'd'];
      expect(
        resolve({ list: { key: 'data.images', skip: 2 } }, { images })
      ).to.deep.equal(['c', 'd']);
      expect(
        resolve({ list: { key: 'data.images', skip: 1, limit: 2 } }, { images })
      ).to.deep.equal(['b', 'c']);
      expect(
        resolve({ list: { key: 'data.images', skip: 9 } }, { images })
      ).to.deep.equal([]);
      expect(
        resolve(
          { list: { key: 'data.images', skip: 0, join: ',' } },
          { images }
        )
      ).to.equal('a,b,c,d');
    });

    it('supports every condition operator', () => {
      const rows = [{ n: 1 }, { n: 2 }, { n: 3 }, { n: '2' }, {}];
      const ids = (condition: any) =>
        resolve(
          {
            list: {
              key: 'data.rows',
              where: [condition],
              item: { key: '$.n', default: '-' },
            },
          },
          { rows }
        );
      expect(ids({ key: '$.n', gt: 1 })).to.deep.equal([2, 3]);
      expect(ids({ key: '$.n', gte: 2 })).to.deep.equal([2, 3]);
      expect(ids({ key: '$.n', lt: 2 })).to.deep.equal([1]);
      expect(ids({ key: '$.n', lte: 2 })).to.deep.equal([1, 2]);
      expect(ids({ key: '$.n', eq: 2 })).to.deep.equal([2]);
      expect(ids({ key: '$.n', neq: 2 })).to.deep.equal([1, 3, '2', '-']);
      expect(ids({ key: '$.n', present: false })).to.deep.equal(['-']);
      expect(ids({ key: '$.n' })).to.deep.equal([1, 2, 3, '2', '-']);
    });
  });

  describe('@now', () => {
    it('updates rendered text when the clock ticks', async () => {
      const saved: Record<string, unknown> = {};
      const keys = [
        'window',
        'document',
        'Node',
        'HTMLElement',
        'Element',
        'MutationObserver',
      ];
      const dom = new JSDOM('<!doctype html><div id="root"></div>');
      const globals = globalThis as any;
      keys.forEach((key) => {
        saved[key] = globals[key];
        globals[key] = key === 'window' ? dom.window : dom.window[key];
      });
      // gsap reads computed styles and may still tick after the test.
      globals.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
      globals.requestAnimationFrame = (callback: () => void) =>
        setTimeout(callback, 0);
      globals.cancelAnimationFrame = (id: any) => clearTimeout(id);
      const realNow = Date.now;
      let current = local(2026, 11, 12, 16, 59).getTime();
      Date.now = () => current;
      try {
        const widget = new TemplateWidget(
          { getMedia: async (url: string) => url } as any,
          {
            widget: {
              name: 'clock',
              template: {
                type: 'text',
                name: 'time',
                opts: { text: { fmt: "{@now | date:'HH:mm'}" }, autofit: {} },
              },
            } as any,
            config: { options: {}, data: {} } as any,
            globals: { target: 'poster' },
          }
        );
        const el = dom.window.document.getElementById('root');
        await firstValueFrom(widget.show(el, 0));
        expect(el.textContent).to.equal('16:59');

        current = local(2026, 11, 12, 17, 0).getTime();
        tickClock();
        expect(el.textContent).to.equal('17:00');
        widget.stop();
      } finally {
        Date.now = realNow;
        keys.forEach((key) => {
          globals[key] = saved[key];
        });
      }
    });

    it('reads other globals with @', () => {
      expect(resolve({ fmt: '{@locale}' }, {}, { locale: 'sv' })).to.equal(
        'sv'
      );
      expect(resolve({ fmt: '{@missing}' }, {}, {})).to.equal('');
    });
  });

  describe('legacy property listing formats', () => {
    const start = '2026-11-12T17:00:00';
    const end = '2026-11-12T18:00:00';
    const viewing = (fmts: string[], value: any) =>
      resolveOption({ first: fmts.map((fmt) => ({ fmt })) }, config(), value, {
        locale: 'sv',
      });
    const pontus = [
      "{$.start | date:'D/M'} kl.{$.start | timed | date:'HH'}-{$.end | date:'HH'}",
      "{$.start | date:'D/M'} kl.{$.start | timed | date:'HH'}",
      "{$.start | date:'D/M'}",
    ];

    it('Pontus Tovesson: 12/11 kl.17-18, without end, and at midnight', () => {
      expect(viewing(pontus, { start, end })).to.equal('12/11 kl.17-18');
      expect(viewing(pontus, { start })).to.equal('12/11 kl.17');
      expect(viewing(pontus, { start: '2026-11-12T00:00:00' })).to.equal(
        '12/11'
      );
    });

    it('Husrum, SFF, SMH and SVDK styles', () => {
      const value = { start, end };
      expect(
        viewing(
          [
            "{$.start | date:'dddd DD/MM' | capitalize} KL. {$.start | date:'HH:mm'}-{$.end | date:'HH:mm'}",
          ],
          value
        )
      ).to.equal('Torsdag 12/11 KL. 17:00-18:00');
      expect(
        viewing(
          [
            "{$.start | date:'ddd DD.M' | capitalize} {$.start | date:'HH.mm'}-{$.end | date:'HH.mm'}",
          ],
          value
        )
      ).to.equal('Tor 12.11 17.00-18.00');
      expect(
        viewing(
          ["{$.start | date:'D MMMM HH:mm'}-{$.end | date:'HH:mm'}"],
          value
        )
      ).to.equal('12 november 17:00-18:00');
      expect(
        viewing(["VISNING {$.start | date:'ddd DD MMM' | upper}"], value)
      ).to.equal('VISNING TOR 12 NOV');
    });

    it('prices with dot grouping (SFF, Nyva)', () => {
      expect(
        resolve({ fmt: "{data.price | number:0:'.'} kr" }, { price: 4950000 })
      ).to.equal('4.950.000 kr');
    });
  });
});
