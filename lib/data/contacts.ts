/**
 * Nationally recognised Pakistan emergency numbers with their official sources.
 * Numbers are facts; verification dates come from the original app dataset
 * (reviewed 2026-02-01). Some services are not available in every district.
 */
export const CONTACTS = [
  { id: 'rescue-1122', number: '1122', name: { en: 'Rescue 1122', ur: 'ریسکیو 1122', roman: 'Rescue 1122' }, use: { en: 'Ambulance, fire, flood rescue, building collapse', ur: 'ایمبولینس، آگ، سیلاب میں ریسکیو، عمارت گرنا', roman: 'Ambulance, aag, selab rescue, imarat girna' }, source: 'https://www.rescue.gov.pk/', coverage: 'Punjab, Khyber Pakhtunkhwa and several other regions' },
  { id: 'police-15', number: '15', name: { en: 'Police emergency', ur: 'پولیس ایمرجنسی', roman: 'Police emergency' }, use: { en: 'Crime, violence, securing an area', ur: 'جرم، تشدد، علاقے کو محفوظ بنانا', roman: 'Jurm, tashaddud, ilaqa mehfooz banana' }, source: 'https://www.punjabpolice.gov.pk/', coverage: 'Nationwide' },
  { id: 'fire-16', number: '16', name: { en: 'Fire brigade', ur: 'فائر بریگیڈ', roman: 'Fire brigade' }, use: { en: 'Fire, gas leak, smoke', ur: 'آگ، گیس لیک، دھواں', roman: 'Aag, gas leak, dhuwan' }, source: 'https://www.ndma.gov.pk/', coverage: 'Most city fire brigades' },
  { id: 'edhi-115', number: '115', name: { en: 'Edhi ambulance', ur: 'ایدھی ایمبولینس', roman: 'Edhi ambulance' }, use: { en: 'Ambulance and patient transfer', ur: 'ایمبولینس اور مریض کی منتقلی', roman: 'Ambulance aur mareez ki muntaqili' }, source: 'https://edhi.org/', coverage: 'Nationwide ambulance network' },
  { id: 'motorway-130', number: '130', name: { en: 'Motorway Police', ur: 'موٹروے پولیس', roman: 'Motorway Police' }, use: { en: 'Accident on a motorway or national highway', ur: 'موٹروے یا قومی شاہراہ پر حادثہ', roman: 'Motorway ya qaumi shahrah par hadsa' }, source: 'https://nhmp.gov.pk/', coverage: 'National highways and motorways' },
] as const;
