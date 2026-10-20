import type { Lang } from './strings';

/**
 * Citizen portal copy. English is authoritative. Urdu and Roman Urdu were
 * written for this project and are flagged in the UI as pending review by a
 * native-speaking emergency professional before any operational use.
 */
type L = Record<Lang, string>;
type LL = Record<Lang, string[]>;

export const C = {
  title: { en: 'Citizen Emergency Portal', ur: 'شہری ہنگامی پورٹل', roman: 'Shehri Hungami Portal' } as L,
  intro: {
    en: 'Preparedness guidance, verified emergency numbers and a demonstration of how an SOS report could be tracked.',
    ur: 'تیاری کی رہنمائی، تصدیق شدہ ہنگامی نمبر، اور ایس او ایس رپورٹ کی ٹریکنگ کا ایک مظاہرہ۔',
    roman: 'Tayyari ki rehnumai, tasdeeq shuda hungami numbers, aur SOS report ki tracking ka aik muzahira.',
  } as L,
  demo: {
    en: 'This SOS form is a demonstration. Submitting it does NOT contact Rescue 1122 or any authority. In a real emergency, call 1122 now.',
    ur: 'یہ ایس او ایس فارم صرف مظاہرہ ہے۔ اسے جمع کرانے سے ریسکیو 1122 یا کسی ادارے سے رابطہ نہیں ہوتا۔ حقیقی ایمرجنسی میں ابھی 1122 پر کال کریں۔',
    roman: 'Yeh SOS form sirf muzahira hai. Isay jama karwane se Rescue 1122 ya kisi idaray se rabta nahin hota. Asal emergency mein abhi 1122 par call karein.',
  } as L,
  translationNote: {
    en: '',
    ur: 'اردو ترجمہ زیرِ جائزہ ہے۔ کسی ابہام کی صورت میں انگریزی متن معتبر ہے۔',
    roman: 'Roman Urdu tarjuma zer-e-jaiza hai. Kisi ibham ki soorat mein English matan motabar hai.',
  } as L,
  numbers: { en: 'Emergency numbers', ur: 'ہنگامی نمبر', roman: 'Hungami numbers' } as L,
  call: { en: 'Call', ur: 'کال کریں', roman: 'Call karein' } as L,
  prepare: { en: 'Be prepared', ur: 'تیار رہیں', roman: 'Tayyar rahein' } as L,
  kit: { en: 'Emergency kit (72 hours)', ur: 'ہنگامی کٹ (72 گھنٹے)', roman: 'Hungami kit (72 ghantay)' } as L,
  kitReady: { en: 'ready', ur: 'تیار', roman: 'tayyar' } as L,
  sos: { en: 'SOS report (demo)', ur: 'ایس او ایس رپورٹ (مظاہرہ)', roman: 'SOS report (muzahira)' } as L,
  category: { en: 'What is happening?', ur: 'کیا ہو رہا ہے؟', roman: 'Kya ho raha hai?' } as L,
  location: { en: 'Location (town, area or landmark)', ur: 'مقام (شہر، علاقہ یا نشانی)', roman: 'Maqam (shehar, ilaqa ya nishani)' } as L,
  useLocation: { en: 'Use my approximate location', ur: 'میرا تقریبی مقام استعمال کریں', roman: 'Mera taqreebi maqam istemal karein' } as L,
  precise: { en: 'Share precise location (otherwise rounded to ~1 km)', ur: 'درست مقام شیئر کریں (ورنہ تقریباً 1 کلومیٹر تک گول)', roman: 'Durust maqam share karein (warna taqreeban 1 km tak gol)' } as L,
  people: { en: 'People needing help', ur: 'مدد کے منتظر افراد', roman: 'Madad ke muntazir afraad' } as L,
  assistance: { en: 'Help needed', ur: 'کس مدد کی ضرورت ہے', roman: 'Kis madad ki zaroorat hai' } as L,
  contact: { en: 'Contact number (optional, stays on this device)', ur: 'رابطہ نمبر (اختیاری، صرف اسی ڈیوائس پر)', roman: 'Rabta number (ikhtiyari, sirf isi device par)' } as L,
  notes: { en: 'Notes (optional)', ur: 'مزید تفصیل (اختیاری)', roman: 'Mazeed tafseel (ikhtiyari)' } as L,
  submit: { en: 'Save demo report', ur: 'مظاہراتی رپورٹ محفوظ کریں', roman: 'Muzahirati report mehfooz karein' } as L,
  myReports: { en: 'My demo reports', ur: 'میری مظاہراتی رپورٹس', roman: 'Meri muzahirati reports' } as L,
  advance: { en: 'Simulate next step', ur: 'اگلا مرحلہ (فرضی)', roman: 'Agla marhala (farzi)' } as L,
  deleteAll: { en: 'Delete all demo reports', ur: 'تمام مظاہراتی رپورٹس حذف کریں', roman: 'Tamam muzahirati reports hazf karein' } as L,
  privacy: {
    en: 'Privacy: reports are stored only in this browser, never uploaded, and deleted automatically after 24 hours. Location is rounded to about 1 km unless you choose otherwise.',
    ur: 'رازداری: رپورٹس صرف اسی براؤزر میں محفوظ ہوتی ہیں، کبھی اپ لوڈ نہیں ہوتیں اور 24 گھنٹے بعد خود بخود حذف ہو جاتی ہیں۔ مقام تقریباً 1 کلومیٹر تک گول کیا جاتا ہے۔',
    roman: 'Razdari: reports sirf isi browser mein mehfooz hoti hain, kabhi upload nahin hotin aur 24 ghantay baad khud ba khud hazf ho jati hain. Maqam taqreeban 1 km tak gol kiya jata hai.',
  } as L,
};

export const CATEGORY_LABEL: Record<string, L> = {
  flood: { en: 'Flood / rising water', ur: 'سیلاب / پانی کا بڑھنا', roman: 'Selab / pani ka barhna' },
  medical: { en: 'Medical emergency', ur: 'طبی ایمرجنسی', roman: 'Tibbi emergency' },
  fire: { en: 'Fire', ur: 'آگ', roman: 'Aag' },
  building_collapse: { en: 'Building collapse', ur: 'عمارت گرنا', roman: 'Imarat girna' },
  trapped: { en: 'People trapped', ur: 'لوگ پھنسے ہوئے ہیں', roman: 'Log phansay huay hain' },
  landslide: { en: 'Landslide / road blocked', ur: 'لینڈ سلائیڈ / سڑک بند', roman: 'Landslide / sarak band' },
  other: { en: 'Other', ur: 'دیگر', roman: 'Deegar' },
};

export const ASSIST_LABEL: Record<string, L> = {
  evacuation: { en: 'Evacuation', ur: 'انخلا', roman: 'Inkhila' },
  medical: { en: 'Medical help', ur: 'طبی مدد', roman: 'Tibbi madad' },
  rescue: { en: 'Rescue', ur: 'ریسکیو', roman: 'Rescue' },
  food_water: { en: 'Food / water', ur: 'خوراک / پانی', roman: 'Khurak / pani' },
  shelter: { en: 'Shelter', ur: 'پناہ گاہ', roman: 'Panahgah' },
  information: { en: 'Information', ur: 'معلومات', roman: 'Maloomat' },
};

export const STATE_LABEL: Record<string, L> = {
  reported: { en: 'Reported', ur: 'درج', roman: 'Darj' },
  reviewed: { en: 'Reviewed', ur: 'جائزہ', roman: 'Jaiza' },
  assigned: { en: 'Assigned', ur: 'تفویض', roman: 'Tafweez' },
  in_progress: { en: 'In progress', ur: 'جاری', roman: 'Jari' },
  resolved: { en: 'Resolved', ur: 'حل', roman: 'Hal' },
};

export const GUIDANCE: { id: string; title: L; steps: LL }[] = [
  {
    id: 'flood',
    title: { en: 'Flood', ur: 'سیلاب', roman: 'Selab' },
    steps: {
      en: ['Move people — especially children, elderly and patients — to higher ground.', 'Never walk or drive through moving water.', 'Switch off electricity at the main only if it is dry and safe.', 'Keep one phone charged and follow PDMA/NDMA announcements.'],
      ur: ['لوگوں کو، خاص طور پر بچوں، بزرگوں اور مریضوں کو، اونچی جگہ پر منتقل کریں۔', 'بہتے پانی میں کبھی پیدل یا گاڑی سے نہ گزریں۔', 'صرف خشک اور محفوظ ہونے کی صورت میں مین سوئچ سے بجلی بند کریں۔', 'ایک فون چارج رکھیں اور پی ڈی ایم اے/این ڈی ایم اے کے اعلانات پر عمل کریں۔'],
      roman: ['Logon ko — khaas taur par bachon, buzurgon aur mareezon ko — oonchi jagah par muntaqil karein.', 'Behtay pani mein kabhi paidal ya gaari se na guzrein.', 'Sirf khushk aur mehfooz hone ki soorat mein main switch se bijli band karein.', 'Aik phone charge rakhein aur PDMA/NDMA ke elanaat par amal karein.'],
    },
  },
  {
    id: 'earthquake',
    title: { en: 'Earthquake', ur: 'زلزلہ', roman: 'Zalzala' },
    steps: {
      en: ['Drop, cover and hold on until the shaking stops.', 'Stay away from windows, heavy furniture and outside walls.', 'After shaking, leave damaged buildings and move to open ground.', 'Expect aftershocks; do not re-enter damaged buildings.'],
      ur: ['جھٹکے رکنے تک جھکیں، کسی مضبوط چیز کے نیچے پناہ لیں اور اسے پکڑے رکھیں۔', 'کھڑکیوں، بھاری فرنیچر اور بیرونی دیواروں سے دور رہیں۔', 'جھٹکے رکنے کے بعد متاثرہ عمارت سے نکل کر کھلی جگہ پر جائیں۔', 'آفٹر شاکس آ سکتے ہیں؛ متاثرہ عمارتوں میں دوبارہ داخل نہ ہوں۔'],
      roman: ['Jhatkay rukne tak jhukein, kisi mazboot cheez ke neeche panah lein aur usay pakray rakhein.', 'Khirkiyon, bhaari furniture aur bairooni deewaron se door rahein.', 'Jhatkay rukne ke baad mutasira imarat se nikal kar khuli jagah par jayen.', 'Aftershocks aa saktay hain; mutasira imaraton mein dobara dakhil na hon.'],
    },
  },
  {
    id: 'heatwave',
    title: { en: 'Heatwave', ur: 'ہیٹ ویو', roman: 'Heatwave' },
    steps: {
      en: ['Drink water often, even if you are not thirsty.', 'Avoid outdoor work between 11 am and 4 pm.', 'Check on elderly neighbours, children and outdoor workers.', 'Confusion, no sweating or fainting can mean heatstroke — call 1122.'],
      ur: ['پیاس نہ بھی ہو تو بار بار پانی پئیں۔', 'صبح 11 بجے سے شام 4 بجے تک باہر کام سے گریز کریں۔', 'بزرگ پڑوسیوں، بچوں اور باہر کام کرنے والوں کا خیال رکھیں۔', 'الجھن، پسینہ نہ آنا یا بے ہوشی ہیٹ اسٹروک ہو سکتا ہے — 1122 پر کال کریں۔'],
      roman: ['Pyaas na bhi ho to baar baar pani piyein.', 'Subah 11 baje se shaam 4 baje tak bahar kaam se guraiz karein.', 'Buzurg parosiyon, bachon aur bahar kaam karne walon ka khayal rakhein.', 'Uljhan, paseena na aana ya behoshi heatstroke ho sakta hai — 1122 par call karein.'],
    },
  },
  {
    id: 'urban',
    title: { en: 'Urban flooding', ur: 'شہری سیلاب', roman: 'Shehri selab' },
    steps: {
      en: ['Stay away from nullahs, drains and underpasses during heavy rain.', 'Do not touch electric poles or wires near water.', 'Move valuables and documents to an upper floor.'],
      ur: ['تیز بارش کے دوران نالوں، گٹروں اور انڈرپاسز سے دور رہیں۔', 'پانی کے قریب بجلی کے کھمبوں یا تاروں کو ہاتھ نہ لگائیں۔', 'قیمتی اشیاء اور کاغذات اوپر والی منزل پر منتقل کریں۔'],
      roman: ['Tez barish ke dauran nalon, gutteron aur underpasses se door rahein.', 'Pani ke qareeb bijli ke khambon ya taaron ko haath na lagayen.', 'Qeemti ashya aur kaghzaat oopar wali manzil par muntaqil karein.'],
    },
  },
];

export const KIT: { id: string; label: L }[] = [
  { id: 'water', label: { en: 'Drinking water (about 4 L per person per day)', ur: 'پینے کا پانی (فی فرد روزانہ تقریباً 4 لیٹر)', roman: 'Peenay ka pani (fi fard rozana taqreeban 4 liter)' } },
  { id: 'firstaid', label: { en: 'First aid kit', ur: 'فرسٹ ایڈ کٹ', roman: 'First aid kit' } },
  { id: 'torch', label: { en: 'Torch and spare batteries', ur: 'ٹارچ اور اضافی بیٹریاں', roman: 'Torch aur izafi batteriyan' } },
  { id: 'medicine', label: { en: 'Medicines (one week) and ORS', ur: 'دوائیں (ایک ہفتہ) اور او آر ایس', roman: 'Dawaiyan (aik hafta) aur ORS' } },
  { id: 'documents', label: { en: 'CNIC and document copies in plastic', ur: 'شناختی کارڈ اور کاغذات کی نقول پلاسٹک میں', roman: 'CNIC aur kaghzaat ki naqool plastic mein' } },
  { id: 'power', label: { en: 'Charged power bank', ur: 'چارج شدہ پاور بینک', roman: 'Charge shuda power bank' } },
  { id: 'cash', label: { en: 'Some cash', ur: 'کچھ نقدی', roman: 'Kuch naqdi' } },
  { id: 'whistle', label: { en: 'Whistle', ur: 'سیٹی', roman: 'Seeti' } },
  { id: 'food', label: { en: 'Dry food for 3 days', ur: '3 دن کی خشک خوراک', roman: '3 din ki khushk khurak' } },
  { id: 'warm', label: { en: 'Warm clothes or blanket', ur: 'گرم کپڑے یا کمبل', roman: 'Garam kapray ya kambal' } },
];
