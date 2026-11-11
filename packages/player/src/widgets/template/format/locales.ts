/**
 * Locale data for template formatters, bundled so formatting never depends on
 * `Intl` (missing or incomplete on Chrome 38 players).
 *
 * Names follow moment.js, which the legacy templates used; number separators
 * follow CLDR (a no-break space groups digits in sv and fr).
 */
export interface LocaleData {
  months: string[];
  monthsShort: string[];
  /** Sunday first. */
  weekdays: string[];
  weekdaysShort: string[];
  meridiem: [string, string];
  group: string;
  decimal: string;
}

const NBSP = '\u00a0';

const split = (names: string) => names.split('_');

const numbered = (suffix: string) =>
  split('1_2_3_4_5_6_7_8_9_10_11_12').map((month) => month + suffix);

export const LOCALES: { [locale: string]: LocaleData } = {
  en: {
    months: split(
      'January_February_March_April_May_June_July_August_September_October_November_December'
    ),
    monthsShort: split('Jan_Feb_Mar_Apr_May_Jun_Jul_Aug_Sep_Oct_Nov_Dec'),
    weekdays: split('Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday'),
    weekdaysShort: split('Sun_Mon_Tue_Wed_Thu_Fri_Sat'),
    meridiem: ['AM', 'PM'],
    group: ',',
    decimal: '.',
  },
  es: {
    months: split(
      'enero_febrero_marzo_abril_mayo_junio_julio_agosto_septiembre_octubre_noviembre_diciembre'
    ),
    monthsShort: split('ene_feb_mar_abr_may_jun_jul_ago_sep_oct_nov_dic'),
    weekdays: split('domingo_lunes_martes_miércoles_jueves_viernes_sábado'),
    weekdaysShort: split('dom_lun_mar_mié_jue_vie_sáb'),
    meridiem: ['a. m.', 'p. m.'],
    group: '.',
    decimal: ',',
  },
  sv: {
    months: split(
      'januari_februari_mars_april_maj_juni_juli_augusti_september_oktober_november_december'
    ),
    monthsShort: split('jan_feb_mar_apr_maj_jun_jul_aug_sep_okt_nov_dec'),
    weekdays: split('söndag_måndag_tisdag_onsdag_torsdag_fredag_lördag'),
    weekdaysShort: split('sön_mån_tis_ons_tor_fre_lör'),
    meridiem: ['fm', 'em'],
    group: NBSP,
    decimal: ',',
  },
  de: {
    months: split(
      'Januar_Februar_März_April_Mai_Juni_Juli_August_September_Oktober_November_Dezember'
    ),
    monthsShort: split('Jan_Feb_Mär_Apr_Mai_Jun_Jul_Aug_Sep_Okt_Nov_Dez'),
    weekdays: split(
      'Sonntag_Montag_Dienstag_Mittwoch_Donnerstag_Freitag_Samstag'
    ),
    weekdaysShort: split('So_Mo_Di_Mi_Do_Fr_Sa'),
    meridiem: ['AM', 'PM'],
    group: '.',
    decimal: ',',
  },
  fr: {
    months: split(
      'janvier_février_mars_avril_mai_juin_juillet_août_septembre_octobre_novembre_décembre'
    ),
    monthsShort: split(
      'janv._févr._mars_avr._mai_juin_juil._août_sept._oct._nov._déc.'
    ),
    weekdays: split('dimanche_lundi_mardi_mercredi_jeudi_vendredi_samedi'),
    weekdaysShort: split('dim._lun._mar._mer._jeu._ven._sam.'),
    meridiem: ['AM', 'PM'],
    group: NBSP,
    decimal: ',',
  },
  zh: {
    months: split(
      '一月_二月_三月_四月_五月_六月_七月_八月_九月_十月_十一月_十二月'
    ),
    monthsShort: numbered('月'),
    weekdays: split('星期日_星期一_星期二_星期三_星期四_星期五_星期六'),
    weekdaysShort: split('周日_周一_周二_周三_周四_周五_周六'),
    meridiem: ['上午', '下午'],
    group: ',',
    decimal: '.',
  },
  ar: {
    months: split(
      'يناير_فبراير_مارس_أبريل_مايو_يونيو_يوليو_أغسطس_سبتمبر_أكتوبر_نوفمبر_ديسمبر'
    ),
    monthsShort: split(
      'يناير_فبراير_مارس_أبريل_مايو_يونيو_يوليو_أغسطس_سبتمبر_أكتوبر_نوفمبر_ديسمبر'
    ),
    weekdays: split('الأحد_الإثنين_الثلاثاء_الأربعاء_الخميس_الجمعة_السبت'),
    weekdaysShort: split('أحد_إثنين_ثلاثاء_أربعاء_خميس_جمعة_سبت'),
    meridiem: ['ص', 'م'],
    group: ',',
    decimal: '.',
  },
  ko: {
    months: numbered('월'),
    monthsShort: numbered('월'),
    weekdays: split('일요일_월요일_화요일_수요일_목요일_금요일_토요일'),
    weekdaysShort: split('일_월_화_수_목_금_토'),
    meridiem: ['오전', '오후'],
    group: ',',
    decimal: '.',
  },
  ja: {
    months: numbered('月'),
    monthsShort: numbered('月'),
    weekdays: split('日曜日_月曜日_火曜日_水曜日_木曜日_金曜日_土曜日'),
    weekdaysShort: split('日_月_火_水_木_金_土'),
    meridiem: ['午前', '午後'],
    group: ',',
    decimal: '.',
  },
};

export const DEFAULT_LOCALE = 'en';

/**
 * Resolves a locale code such as "sv-SE" or "SV" to a bundled locale,
 * falling back to English.
 */
export function resolveLocale(locale?: string): string {
  if (typeof locale !== 'string' || locale === '') {
    return DEFAULT_LOCALE;
  }
  const language = locale.toLowerCase().split(/[-_]/)[0];
  return Object.prototype.hasOwnProperty.call(LOCALES, language)
    ? language
    : DEFAULT_LOCALE;
}

export function localeData(locale?: string): LocaleData {
  return LOCALES[resolveLocale(locale)];
}
