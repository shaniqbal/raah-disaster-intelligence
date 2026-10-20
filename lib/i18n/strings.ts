/**
 * UI strings. English is authoritative. Urdu and Roman Urdu cover navigation
 * and the citizen portal; safety-critical sentences carry a "pending review"
 * notice in the UI until validated by a native-speaking emergency professional.
 */
export type Lang = 'en' | 'ur' | 'roman';

export const LANGS: { id: Lang; label: string; dir: 'ltr' | 'rtl' }[] = [
  { id: 'en', label: 'English', dir: 'ltr' },
  { id: 'ur', label: 'اردو', dir: 'rtl' },
  { id: 'roman', label: 'Roman Urdu', dir: 'ltr' },
];

type Dict = Record<string, { en: string; ur: string; roman: string }>;

export const STRINGS = {
  overview: { en: 'Mission Control', ur: 'مشن کنٹرول', roman: 'Mission Control' },
  live: { en: 'Live Data', ur: 'لائیو ڈیٹا', roman: 'Live Data' },
  risk: { en: 'Risk Intelligence', ur: 'خطرے کا تجزیہ', roman: 'Khatray ka Tajzia' },
  simulator: { en: 'Disaster Simulator', ur: 'آفت سمیلیٹر', roman: 'Aafat Simulator' },
  map: { en: 'Maps & Layers', ur: 'نقشے اور تہیں', roman: 'Naqshay aur Layers' },
  evacuation: { en: 'Evacuation Planner', ur: 'انخلا منصوبہ', roman: 'Inkhila Mansooba' },
  resources: { en: 'Rescue Coordination', ur: 'ریسکیو رابطہ کاری', roman: 'Rescue Rabta Kari' },
  sos: { en: 'Citizen SOS', ur: 'شہری ایس او ایس', roman: 'Shehri SOS' },
  history: { en: 'Historical Events', ur: 'تاریخی واقعات', roman: 'Tareekhi Waqiat' },
  copilot: { en: 'AI Copilot', ur: 'اے آئی معاون', roman: 'AI Muawin' },
  methodology: { en: 'Methodology', ur: 'طریقہ کار', roman: 'Tareeqa Kaar' },
  demo: { en: 'Judge Demo', ur: 'ججز ڈیمو', roman: 'Judges Demo' },
  demoBanner: {
    en: 'Public demonstration — not an emergency service',
    ur: 'عوامی مظاہرہ — یہ ہنگامی سروس نہیں ہے',
    roman: 'Awami muzahira — yeh emergency service nahin hai',
  },
  callNow: { en: 'In an emergency call 1122', ur: 'ہنگامی صورت میں 1122 پر کال کریں', roman: 'Emergency mein 1122 par call karein' },
} satisfies Dict;

export type StringKey = keyof typeof STRINGS;

export function t(key: StringKey, lang: Lang): string {
  return STRINGS[key][lang];
}
