import type { Region } from '@/lib/domain/types';

/**
 * Focus regions. Coordinates marked `natural-earth` come from Natural Earth
 * populated places; `approximate` coordinates are town centres rounded to
 * ~0.01° and should be verified against OpenStreetMap before operational use.
 *
 * sizeClass and heatClass are analyst classifications (mode: assumption),
 * documented in docs/MODEL_METHODOLOGY.md.
 */
export interface RegionWithWaterways extends Region {
  /** Waterways that matter locally but are absent from Natural Earth 1:10m rivers. */
  localWaterways?: { name: string; analystProximityScore: number };
}

export const REGIONS: RegionWithWaterways[] = [
  { id: 'islamabad', name: 'Islamabad', nameUr: 'اسلام آباد', province: 'Islamabad Capital Territory', coord: [73.081, 33.689], coordSource: 'natural-earth', terrain: 'foothill', sizeClass: 4, heatClass: 1, historicalEvents: ['eq-2005-kashmir', 'eq-2019-mirpur', 'uf-2001-islamabad'], localWaterways: { name: 'Lai Nullah headwaters', analystProximityScore: 5 } },
  { id: 'rawalpindi', name: 'Rawalpindi', nameUr: 'راولپنڈی', province: 'Punjab', coord: [73.068, 33.591], coordSource: 'natural-earth', terrain: 'foothill', sizeClass: 4, heatClass: 1, historicalEvents: ['eq-2005-kashmir', 'eq-2019-mirpur', 'uf-2001-islamabad'], localWaterways: { name: 'Lai Nullah', analystProximityScore: 8 } },
  { id: 'lahore', name: 'Lahore', nameUr: 'لاہور', province: 'Punjab', coord: [74.348, 31.562], coordSource: 'natural-earth', terrain: 'plain', sizeClass: 5, heatClass: 2, historicalEvents: [] },
  { id: 'muzaffargarh', name: 'Muzaffargarh', nameUr: 'مظفرگڑھ', province: 'Punjab', coord: [71.193, 30.072], coordSource: 'approximate', terrain: 'riverine', sizeClass: 3, heatClass: 2, historicalEvents: ['fl-2010-indus'] },
  { id: 'multan', name: 'Multan', nameUr: 'ملتان', province: 'Punjab', coord: [71.453, 30.202], coordSource: 'natural-earth', terrain: 'plain', sizeClass: 4, heatClass: 2, historicalEvents: [] },
  { id: 'rajanpur', name: 'Rajanpur', nameUr: 'راجن پور', province: 'Punjab', coord: [70.33, 29.104], coordSource: 'approximate', terrain: 'riverine', sizeClass: 2, heatClass: 2, historicalEvents: ['fl-2010-indus', 'fl-2022-monsoon'] },
  { id: 'dgkhan', name: 'Dera Ghazi Khan', nameUr: 'ڈیرہ غازی خان', province: 'Punjab', coord: [70.635, 30.06], coordSource: 'natural-earth', terrain: 'riverine', sizeClass: 3, heatClass: 2, historicalEvents: ['fl-2010-indus', 'fl-2022-monsoon'] },
  { id: 'sukkur', name: 'Sukkur', nameUr: 'سکھر', province: 'Sindh', coord: [68.849, 27.714], coordSource: 'natural-earth', terrain: 'riverine', sizeClass: 3, heatClass: 3, historicalEvents: ['fl-2010-indus', 'fl-2022-monsoon', 'hw-2022-jacobabad'] },
  { id: 'hyderabad', name: 'Hyderabad', nameUr: 'حیدرآباد', province: 'Sindh', coord: [68.373, 25.382], coordSource: 'natural-earth', terrain: 'riverine', sizeClass: 4, heatClass: 2, historicalEvents: ['fl-2022-monsoon'] },
  { id: 'karachi', name: 'Karachi', nameUr: 'کراچی', province: 'Sindh', coord: [66.988, 24.872], coordSource: 'natural-earth', terrain: 'coastal', sizeClass: 5, heatClass: 1, historicalEvents: ['eq-1945-makran', 'hw-2015-karachi', 'fl-2022-monsoon'], localWaterways: { name: 'Lyari and Malir rivers', analystProximityScore: 5 } },
  { id: 'peshawar', name: 'Peshawar', nameUr: 'پشاور', province: 'Khyber Pakhtunkhwa', coord: [71.533, 34.007], coordSource: 'natural-earth', terrain: 'plain', sizeClass: 4, heatClass: 2, historicalEvents: ['fl-2010-indus', 'eq-2015-hindukush'], localWaterways: { name: 'Kabul River and Bara River', analystProximityScore: 6 } },
  { id: 'nowshera', name: 'Nowshera', nameUr: 'نوشہرہ', province: 'Khyber Pakhtunkhwa', coord: [71.975, 34.016], coordSource: 'approximate', terrain: 'riverine', sizeClass: 2, heatClass: 2, historicalEvents: ['fl-2010-indus'], localWaterways: { name: 'Kabul River', analystProximityScore: 9 } },
  { id: 'swat', name: 'Swat (Mingora/Saidu Sharif)', nameUr: 'سوات', province: 'Khyber Pakhtunkhwa', coord: [72.35, 34.75], coordSource: 'natural-earth', terrain: 'mountain', sizeClass: 3, heatClass: 0, historicalEvents: ['fl-2010-indus', 'fl-2022-monsoon', 'eq-2015-hindukush'], localWaterways: { name: 'Swat River', analystProximityScore: 9 } },
  { id: 'chitral', name: 'Chitral', nameUr: 'چترال', province: 'Khyber Pakhtunkhwa', coord: [71.786, 35.851], coordSource: 'approximate', terrain: 'mountain', sizeClass: 1, heatClass: 0, historicalEvents: ['eq-2015-hindukush'], localWaterways: { name: 'Chitral (Kunar) River', analystProximityScore: 8 } },
  { id: 'gilgit', name: 'Gilgit', nameUr: 'گلگت', province: 'Gilgit-Baltistan', coord: [74.3, 35.917], coordSource: 'natural-earth', terrain: 'mountain', sizeClass: 2, heatClass: 0, historicalEvents: ['ls-2010-attabad', 'eq-2015-hindukush'], localWaterways: { name: 'Gilgit and Hunza rivers', analystProximityScore: 7 } },
  { id: 'quetta', name: 'Quetta', nameUr: 'کوئٹہ', province: 'Balochistan', coord: [67.023, 30.222], coordSource: 'natural-earth', terrain: 'mountain', sizeClass: 3, heatClass: 0, historicalEvents: ['eq-1935-quetta', 'eq-2008-ziarat', 'eq-2013-awaran', 'fl-2022-monsoon'] },
  { id: 'jacobabad', name: 'Jacobabad', nameUr: 'جیکب آباد', province: 'Sindh', coord: [68.438, 28.282], coordSource: 'approximate', terrain: 'plain', sizeClass: 2, heatClass: 3, historicalEvents: ['fl-2010-indus', 'fl-2022-monsoon', 'hw-2022-jacobabad'] },
  { id: 'dadu', name: 'Dadu', nameUr: 'دادو', province: 'Sindh', coord: [67.776, 26.731], coordSource: 'approximate', terrain: 'riverine', sizeClass: 2, heatClass: 3, historicalEvents: ['fl-2010-indus', 'fl-2022-monsoon', 'hw-2022-jacobabad'] },
];

export const regionById = (id: string) => REGIONS.find((r) => r.id === id);
