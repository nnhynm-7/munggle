/* =============================================================
   Munggle (멍글) — shared data + AI prompts
   브라우저(app.html)와 서버(server.js)가 이 파일 하나를 같이 쓴다.
   → 서버는 여기 있는 프롬프트로만 AI를 호출하므로, 외부에서 임의의
     프롬프트를 보내 API 키를 악용할 수 없다.
   기획 수정(상황 추가, 말투, 피드백 항목, 언어 추가)은 이 파일에서!
   ============================================================= */
(function (root) {
// name: AI에게 알려주는 언어 이름 / label: 화면에 보이는 이름 / stt: 음성 인식 언어 코드
const LANGS = {
  en:  { name: "English", label: "English", stt: "en-US" },
  ja:  { name: "Japanese", label: "日本語", stt: "ja-JP" },
  zh:  { name: "Simplified Chinese", label: "简体中文", stt: "zh-CN" },
  zht: { name: "Traditional Chinese", label: "繁體中文", stt: "zh-TW" },
  vi:  { name: "Vietnamese", label: "Tiếng Việt", stt: "vi-VN" },
  th:  { name: "Thai", label: "ภาษาไทย", stt: "th-TH" },
  id:  { name: "Indonesian", label: "Bahasa Indonesia", stt: "id-ID" },
  es:  { name: "Spanish", label: "Español", stt: "es-ES" },
  fr:  { name: "French", label: "Français", stt: "fr-FR" },
  de:  { name: "German", label: "Deutsch", stt: "de-DE" },
  pt:  { name: "Portuguese", label: "Português", stt: "pt-BR" },
  ru:  { name: "Russian", label: "Русский", stt: "ru-RU" },
};
// short: 설정 슬라이더에 보이는 이름
const LEVELS = {
  zero: { label: "Beginner", short: "Beginner", guide: "Absolute beginner. Speak very short, simple, slow sentences (under 8 words). Always polite 해요체.", rate: 0.8,
    teach: "Teach only essential survival words and short phrases (1-4 words). Always include romanization. Usually one phrase per answer. Explain in very simple words. Practice = repeat it or pick the right phrase from two options." },
  some: { label: "Intermediate", short: "Intermediate", guide: "Knows basic phrases. Use simple everyday Korean, short sentences, polite 해요체.", rate: 0.9,
    teach: "Teach everyday phrases together with one simple grammar pattern (e.g. -주세요, -있어요?, -이에요/예요, -고 싶어요). Include romanization. Practice = fill in the blank or translate a short sentence." },
  conv: { label: "Advanced", short: "Advanced", guide: "Can hold a conversation. Speak naturally like real staff, including common service expressions (합쇼체 where natural).", rate: 1.0,
    teach: "Teach natural, native-like Korean: nuance, politeness levels (합니다/해요/반말), softening words (좀, 혹시), spoken contractions, idioms and current slang. Keep romanization short. Practice = say a full natural sentence for a realistic scene." },
};

// STARTERS (Intermediate) is kept for older code; see STARTERS_BY_LEVEL below.

// Each situation borrows a Seoul subway line color (badge number = line).
// staff: 대화 화면에서 멍글이가 맡는 역할 이름
const SIMS = [
  { id: "bbq", line: 1, ko: "고깃집", en: "Korean BBQ", staff: "Server", goal: "Get a table, order 2 portions of samgyeopsal, ask for less spicy side dishes and pay.",
    role: "a busy but kind server at a samgyeopsal (pork belly BBQ) restaurant in Mapo, Seoul", place: "Korean BBQ restaurant",
    open: { ko: "어서 오세요! 몇 분이세요?", rom: "Eoseo oseyo! Myeot buniseyo?", meaning: "Welcome! How many people?" },
    sug: [{ ko: "두 명이요.", rom: "Du myeong-iyo.", meaning: "Two people." }, { ko: "혼자예요.", rom: "Honjayeyo.", meaning: "Just me." }] },
  { id: "cvs", line: 2, ko: "편의점", en: "Convenience store", staff: "Clerk", goal: "Pay for your snacks, ask to heat up a lunchbox and get a bag.",
    role: "a young clerk at a GS25 convenience store", place: "convenience store checkout",
    open: { ko: "어서 오세요~ 이거 다 계산해 드릴까요?", rom: "Eoseo oseyo~ Igeo da gyesanhae deurilkkayo?", meaning: "Welcome~ Shall I ring all of these up?" },
    sug: [{ ko: "네, 봉투도 주세요.", rom: "Ne, bongtudo juseyo.", meaning: "Yes, and a bag please." }, { ko: "이거 데워 주세요.", rom: "Igeo dewo juseyo.", meaning: "Please heat this up." }] },
  { id: "taxi", line: 3, ko: "택시", en: "Taxi", staff: "Driver", goal: "Tell the driver your destination, ask how long it takes, and pay by card.",
    role: "a middle-aged Seoul taxi driver", place: "inside a taxi in Seoul",
    open: { ko: "어디로 가세요?", rom: "Eodiro gaseyo?", meaning: "Where are you going?" },
    sug: [{ ko: "명동역으로 가 주세요.", rom: "Myeongdong-yeogeuro ga juseyo.", meaning: "To Myeongdong Station, please." }, { ko: "이 주소로 가 주세요.", rom: "I jusoro ga juseyo.", meaning: "Please go to this address." }] },
  { id: "subway", line: 4, ko: "지하철역", en: "Subway station", staff: "Station staff", goal: "Top up your T-money card and ask which line goes to Gangnam.",
    role: "a helpful station staff member at the info desk of Seoul Station subway", place: "subway station information desk",
    open: { ko: "네, 무엇을 도와드릴까요?", rom: "Ne, mueoseul dowadeurilkkayo?", meaning: "Yes, how can I help you?" },
    sug: [{ ko: "티머니 충전하고 싶어요.", rom: "Timeoni chungjeonhago sipeoyo.", meaning: "I'd like to top up my T-money." }, { ko: "강남역에 어떻게 가요?", rom: "Gangnam-yeoge eotteoke gayo?", meaning: "How do I get to Gangnam Station?" }] },
  { id: "cafe", line: 5, ko: "카페", en: "Café", staff: "Barista", goal: "Order an iced americano, choose the size, and say whether it's for here or to go.",
    role: "a barista at a trendy café in Seongsu-dong", place: "café counter",
    open: { ko: "주문 도와드릴게요. 드시고 가세요?", rom: "Jumun dowadeurilgeyo. Deusigo gaseyo?", meaning: "I'll take your order. Is it for here?" },
    sug: [{ ko: "아이스 아메리카노 한 잔 주세요.", rom: "Aiseu amerikano han jan juseyo.", meaning: "One iced americano, please." }, { ko: "포장이요.", rom: "Pojang-iyo.", meaning: "To go, please." }] },
  { id: "shop", line: 6, ko: "옷 가게", en: "Clothes shopping", staff: "Shop staff", goal: "Ask to try something on, ask for another size, and ask if they have it in another color.",
    role: "a friendly staff member at a clothing boutique in Hongdae", place: "clothing store",
    open: { ko: "안녕하세요~ 편하게 보세요!", rom: "Annyeonghaseyo~ Pyeonhage boseyo!", meaning: "Hello~ Take your time looking around!" },
    sug: [{ ko: "이거 입어 봐도 돼요?", rom: "Igeo ibeo bwado dwaeyo?", meaning: "Can I try this on?" }, { ko: "그냥 구경하는 거예요.", rom: "Geunyang gugyeonghaneun geoyeyo.", meaning: "I'm just looking." }] },
  { id: "olive", line: 7, ko: "올리브영", en: "Olive Young", staff: "Store staff", goal: "Ask for a sunscreen recommendation, ask about the 1+1 deal and get a tax refund.",
    role: "a staff member at an Olive Young health & beauty store in Myeongdong", place: "Olive Young store",
    open: { ko: "안녕하세요~ 찾으시는 거 있으세요?", rom: "Annyeonghaseyo~ Chajeusineun geo isseuseyo?", meaning: "Hello~ Are you looking for anything?" },
    sug: [{ ko: "선크림 추천해 주세요.", rom: "Seonkeurim chucheonhae juseyo.", meaning: "Please recommend a sunscreen." }, { ko: "이거 원 플러스 원이에요?", rom: "Igeo won peulleoseu wonieyo?", meaning: "Is this buy-one-get-one?" }] },
  { id: "hotel", line: 8, ko: "호텔", en: "Hotel check-in", staff: "Front desk", goal: "Check in, ask what time breakfast is and get the Wi-Fi password.",
    role: "a front desk staff member at a hotel in Jongno, Seoul", place: "hotel front desk",
    open: { ko: "안녕하세요! 체크인하시겠어요?", rom: "Annyeonghaseyo! Chekeuinhasigesseoyo?", meaning: "Hello! Would you like to check in?" },
    sug: [{ ko: "네, 예약했어요.", rom: "Ne, yeyakaesseoyo.", meaning: "Yes, I have a reservation." }, { ko: "와이파이 비밀번호가 뭐예요?", rom: "Waipai bimilbeonhoga mwoyeyo?", meaning: "What's the Wi-Fi password?" }] },
  { id: "pharm", line: 9, ko: "약국", en: "Pharmacy", staff: "Pharmacist", goal: "Describe your symptom (headache or upset stomach) and ask how to take the medicine.",
    role: "a calm pharmacist at a neighborhood pharmacy", place: "pharmacy",
    open: { ko: "어디가 불편하세요?", rom: "Eodiga bulpyeonhaseyo?", meaning: "What seems to be the problem?" },
    sug: [{ ko: "머리가 아파요.", rom: "Meoriga apayo.", meaning: "I have a headache." }, { ko: "배가 아파요.", rom: "Baega apayo.", meaning: "My stomach hurts." }] },
];


/* ---------------- content that changes with the learner's level ---------------- */
// zero = Beginner, some = Intermediate, conv = Advanced

// Ask Munggli 첫 화면 예시 질문 (수준별)
const STARTERS_BY_LEVEL = {
  zero: [
    { t: "How do I say hello and thank you?", s: "First words" },
    { t: "Teach me to read ㄱ ㄴ ㄷ ㄹ", s: "Read Hangul" },
    { t: "How do I say \"this one, please\"?", s: "Ordering" },
    { t: "How do I count 1 to 5 in Korean?", s: "Numbers" },
    { t: "How do I ask \"where is the restroom?\"", s: "Asking" },
    { t: "How do I say yes, no and sorry?", s: "Basics" },
    { t: "Quiz me on 3 easy words", s: "Quiz me" },
    { t: "What does ㅋㅋ mean in texts?", s: "Texting slang" },
  ],
  some: [
    { t: "How do I say \"thank you\" politely?", s: "How do I say" },
    { t: "What's the difference between 안녕하세요 and 안녕?", s: "What's the difference" },
    { t: "Break down 주세요 for me. When do I use it?", s: "Break it down" },
    { t: "Teach me to read ㄱ ㄴ ㄷ ㄹ", s: "Read Hangul" },
    { t: "How do Korean numbers work when I order food?", s: "Numbers" },
    { t: "Quiz me on 3 café phrases", s: "Quiz me" },
    { t: "What are some popular Korean slangs?", s: "Korean slangs" },
    { t: "What do ㅋㅋ, ㅎㅇ, ㄹㅇ and ㅇㅈ mean in texts?", s: "Texting slang" },
  ],
  conv: [
    { t: "When do I use 합니다, 해요 and 반말?", s: "Politeness levels" },
    { t: "How do I refuse politely without sounding rude?", s: "Nuance" },
    { t: "How do Koreans really say \"what's up?\" to friends?", s: "Natural speech" },
    { t: "Explain the nuance of 좀 and 혹시", s: "Softening words" },
    { t: "How do I make small talk with a taxi driver?", s: "Small talk" },
    { t: "Correct my Korean: 저는 한국 음식을 너무 좋아해요", s: "Check my Korean" },
    { t: "What are some popular Korean slangs?", s: "Korean slangs" },
    { t: "Quiz me with a real-life situation", s: "Quiz me" },
  ],
};

// 홈 화면 "Today's phrase" (수준별, 날짜마다 바뀜)
const TODAY_BY_LEVEL = {
  zero: [
    { ko: "감사합니다", rom: "gam-sa-ham-ni-da", meaning: "Thank you" },
    { ko: "안녕하세요", rom: "an-nyeong-ha-se-yo", meaning: "Hello" },
    { ko: "이거 주세요", rom: "i-geo ju-se-yo", meaning: "This one, please" },
    { ko: "얼마예요?", rom: "eol-ma-ye-yo?", meaning: "How much is it?" },
    { ko: "화장실 어디예요?", rom: "hwa-jang-sil eo-di-ye-yo?", meaning: "Where's the restroom?" },
    { ko: "물 주세요", rom: "mul ju-se-yo", meaning: "Water, please" },
    { ko: "맛있어요!", rom: "ma-si-sseo-yo!", meaning: "It's delicious!" },
    { ko: "괜찮아요", rom: "gwaen-cha-na-yo", meaning: "It's okay / No thanks" },
    { ko: "죄송합니다", rom: "joe-song-ham-ni-da", meaning: "I'm sorry" },
    { ko: "여기요!", rom: "yeo-gi-yo!", meaning: "Excuse me! (calling staff)" },
    { ko: "네 / 아니요", rom: "ne / a-ni-yo", meaning: "Yes / No" },
    { ko: "잠깐만요", rom: "jam-kkan-man-yo", meaning: "Just a moment" },
  ],
  some: [
    { ko: "천천히 말해 주세요", rom: "cheon-cheon-hi mal-hae ju-se-yo", meaning: "Please speak slowly" },
    { ko: "카드 돼요?", rom: "ka-deu dwae-yo?", meaning: "Can I pay by card?" },
    { ko: "사진 찍어 주세요", rom: "sa-jin jji-geo ju-se-yo", meaning: "Could you take a photo?" },
    { ko: "이거 매워요?", rom: "i-geo mae-wo-yo?", meaning: "Is this spicy?" },
    { ko: "포장해 주세요", rom: "po-jang-hae ju-se-yo", meaning: "To go, please" },
    { ko: "영수증 주세요", rom: "yeong-su-jeung ju-se-yo", meaning: "Receipt, please" },
    { ko: "다시 한번 말해 주세요", rom: "da-si han-beon mal-hae ju-se-yo", meaning: "Could you say that again?" },
    { ko: "추천해 주세요", rom: "chu-cheon-hae ju-se-yo", meaning: "What do you recommend?" },
    { ko: "얼마나 걸려요?", rom: "eol-ma-na geol-lyeo-yo?", meaning: "How long does it take?" },
    { ko: "한국어 조금 해요", rom: "han-gu-geo jo-geum hae-yo", meaning: "I speak a little Korean" },
    { ko: "잘 먹겠습니다", rom: "jal meok-get-seum-ni-da", meaning: "Thanks for the meal (before eating)" },
    { ko: "안녕히 계세요", rom: "an-nyeong-hi gye-se-yo", meaning: "Goodbye (when you are leaving)" },
  ],
  conv: [
    { ko: "혹시 자리 있어요?", rom: "hok-si ja-ri i-sseo-yo?", meaning: "Do you happen to have a table?" },
    { ko: "덜 맵게 해 주실 수 있어요?", rom: "deol maep-ge hae ju-sil su i-sseo-yo?", meaning: "Could you make it less spicy?" },
    { ko: "계산은 따로 할게요", rom: "gye-sa-neun tta-ro hal-ge-yo", meaning: "We'll pay separately" },
    { ko: "이거 교환할 수 있을까요?", rom: "i-geo gyo-hwan-hal su i-sseul-kka-yo?", meaning: "Could I exchange this?" },
    { ko: "길 좀 여쭤봐도 될까요?", rom: "gil jom yeo-jjwo-bwa-do doel-kka-yo?", meaning: "May I ask for directions?" },
    { ko: "생각보다 너무 맛있네요!", rom: "saeng-gak-bo-da neo-mu ma-sin-ne-yo!", meaning: "This is way better than I expected!" },
    { ko: "짐 좀 맡겨도 될까요?", rom: "jim jom mat-gyeo-do doel-kka-yo?", meaning: "Could I leave my luggage here?" },
    { ko: "다음 역에서 내리면 돼요?", rom: "da-eum yeo-ge-seo nae-ri-myeon dwae-yo?", meaning: "Do I get off at the next station?" },
    { ko: "사진 한 장만 찍어 주실 수 있어요?", rom: "sa-jin han jang-man jji-geo ju-sil su i-sseo-yo?", meaning: "Could you take just one photo for me?" },
    { ko: "영어 메뉴판 있어요?", rom: "yeong-eo me-nyu-pan i-sseo-yo?", meaning: "Do you have an English menu?" },
    { ko: "여기 완전 핫플이네요!", rom: "yeo-gi wan-jeon hat-peu-ri-ne-yo!", meaning: "This place is such a hot spot!" },
    { ko: "오늘 정말 감사했습니다", rom: "o-neul jeong-mal gam-sa-haet-seum-ni-da", meaning: "Thank you so much for today" },
  ],
};

// 상황극의 수준별 버전: Intermediate(some)는 SIMS의 기본값을 쓰고, Beginner/Advanced는 여기서 바꾼다.
const SIM_LEVELS = {
  bbq: {
    zero: { goal: "Say how many people you are and order one dish.",
      open: { ko: "어서 오세요! 몇 분이세요?", rom: "Eo-seo o-se-yo! Myeot bu-ni-se-yo?", meaning: "Welcome! How many people?" },
      sug: [{ ko: "두 명이요.", rom: "Du myeong-i-yo.", meaning: "Two people." }, { ko: "한 명이요.", rom: "Han myeong-i-yo.", meaning: "One person." }] },
    conv: { goal: "It's busy: agree to wait for a table for 3, order samgyeopsal and a drink, ask the server to grill the meat, and split the bill.",
      open: { ko: "어서 오세요! 지금 자리가 다 차서 10분 정도 기다리셔야 하는데 괜찮으세요?", rom: "Eo-seo o-se-yo! Ji-geum ja-ri-ga da cha-seo sip-bun jeong-do gi-da-ri-syeo-ya ha-neun-de gwaen-cha-neu-se-yo?", meaning: "Welcome! We're full right now, so you'd need to wait about 10 minutes. Is that okay?" },
      sug: [{ ko: "네, 기다릴게요. 세 명이에요.", rom: "Ne, gi-da-ril-ge-yo. Se myeong-i-e-yo.", meaning: "Sure, we'll wait. There are three of us." }, { ko: "혹시 바깥 자리는 없나요?", rom: "Hok-si ba-kkat ja-ri-neun eom-na-yo?", meaning: "Is there any seating outside, by chance?" }] },
  },
  cvs: {
    zero: { goal: "Pay for a snack and answer yes or no about a bag.",
      open: { ko: "봉투 필요하세요?", rom: "Bong-tu pi-ryo-ha-se-yo?", meaning: "Do you need a bag?" },
      sug: [{ ko: "네, 주세요.", rom: "Ne, ju-se-yo.", meaning: "Yes, please." }, { ko: "아니요, 괜찮아요.", rom: "A-ni-yo, gwaen-cha-na-yo.", meaning: "No, I'm fine." }] },
    conv: { goal: "Use a 1+1 deal, ask to heat a lunchbox, pay with your transit card, and say you don't need the receipt.",
      open: { ko: "이거 1+1 행사 상품이라 하나 더 가져오셔도 돼요.", rom: "I-geo won-peul-leo-seu-won haeng-sa sang-pu-mi-ra ha-na deo ga-jyeo-o-syeo-do dwae-yo.", meaning: "This is a buy-one-get-one item, so you can grab another one." },
      sug: [{ ko: "아, 그래요? 하나 더 가져올게요.", rom: "A, geu-rae-yo? Ha-na deo ga-jyeo-ol-ge-yo.", meaning: "Oh really? I'll grab another one." }, { ko: "괜찮아요, 이것만 계산해 주세요.", rom: "Gwaen-cha-na-yo, i-geon-man gye-san-hae ju-se-yo.", meaning: "That's okay, just this one please." }] },
  },
  taxi: {
    zero: { goal: "Tell the driver where you want to go.",
      open: { ko: "어디로 가세요?", rom: "Eo-di-ro ga-se-yo?", meaning: "Where to?" },
      sug: [{ ko: "명동이요.", rom: "Myeong-dong-i-yo.", meaning: "Myeongdong, please." }, { ko: "여기요.", rom: "Yeo-gi-yo.", meaning: "Here (showing the address)." }] },
    conv: { goal: "Give the destination, ask the driver to take a less crowded route, ask roughly how much it will cost, and pay by card.",
      open: { ko: "어디로 모실까요? 지금 퇴근 시간이라 좀 막힐 수도 있어요.", rom: "Eo-di-ro mo-sil-kka-yo? Ji-geum toe-geun si-ga-ni-ra jom ma-kil su-do i-sseo-yo.", meaning: "Where can I take you? It's rush hour, so traffic might be heavy." },
      sug: [{ ko: "강남역이요. 혹시 덜 막히는 길로 가 주실 수 있어요?", rom: "Gang-nam-yeo-gi-yo. Hok-si deol ma-ki-neun gil-lo ga ju-sil su i-sseo-yo?", meaning: "Gangnam Station. Could you take a less busy route?" }, { ko: "요금 대충 얼마 정도 나와요?", rom: "Yo-geum dae-chung eol-ma jeong-do na-wa-yo?", meaning: "Roughly how much will the fare be?" }] },
  },
  subway: {
    zero: { goal: "Ask where Line 2 is.",
      open: { ko: "도와드릴까요?", rom: "Do-wa-deu-ril-kka-yo?", meaning: "Can I help you?" },
      sug: [{ ko: "2호선 어디예요?", rom: "I-ho-seon eo-di-ye-yo?", meaning: "Where is Line 2?" }, { ko: "화장실 어디예요?", rom: "Hwa-jang-sil eo-di-ye-yo?", meaning: "Where's the restroom?" }] },
    conv: { goal: "Report that you left your bag on the train, describe it (color, where you sat), and ask how to get it back.",
      open: { ko: "네, 무슨 일이세요?", rom: "Ne, mu-seun i-ri-se-yo?", meaning: "Yes, what happened?" },
      sug: [{ ko: "가방을 지하철에 두고 내렸어요.", rom: "Ga-bang-eul ji-ha-cheo-re du-go nae-ryeo-sseo-yo.", meaning: "I left my bag on the train." }, { ko: "분실물 센터는 어디에 있어요?", rom: "Bun-sil-mul sen-teo-neun eo-di-e i-sseo-yo?", meaning: "Where is the lost and found?" }] },
  },
  cafe: {
    zero: { goal: "Order one drink.",
      open: { ko: "주문하시겠어요?", rom: "Ju-mun-ha-si-ge-sseo-yo?", meaning: "Ready to order?" },
      sug: [{ ko: "아메리카노 주세요.", rom: "A-me-ri-ka-no ju-se-yo.", meaning: "An americano, please." }, { ko: "라떼 주세요.", rom: "Ra-tte ju-se-yo.", meaning: "A latte, please." }] },
    conv: { goal: "Order a customized drink (less ice, oat milk, extra shot), ask for the Wi-Fi password, and use a stamp card.",
      open: { ko: "안녕하세요, 주문 도와드릴게요. 매장에서 드시고 가세요?", rom: "An-nyeong-ha-se-yo, ju-mun do-wa-deu-ril-ge-yo. Mae-jang-e-seo deu-si-go ga-se-yo?", meaning: "Hello, I'll take your order. Will you have it here?" },
      sug: [{ ko: "네, 먹고 갈게요. 아이스 라떼 하나요, 얼음 적게 오트 우유로 해 주세요.", rom: "Ne, meok-go gal-ge-yo. A-i-seu ra-tte ha-na-yo, eo-reum jeok-ge o-teu u-yu-ro hae ju-se-yo.", meaning: "Yes, for here. One iced latte with less ice and oat milk, please." }, { ko: "포장할게요. 샷 추가 돼요?", rom: "Po-jang-hal-ge-yo. Syat chu-ga dwae-yo?", meaning: "To go. Can I add an extra shot?" }] },
  },
  shop: {
    zero: { goal: "Ask how much one item costs.",
      open: { ko: "어서 오세요~", rom: "Eo-seo o-se-yo~", meaning: "Welcome~" },
      sug: [{ ko: "이거 얼마예요?", rom: "I-geo eol-ma-ye-yo?", meaning: "How much is this?" }, { ko: "그냥 볼게요.", rom: "Geu-nyang bol-ge-yo.", meaning: "I'm just looking." }] },
    conv: { goal: "Try something on, ask for another size and color, check if the sale applies, and ask about the exchange policy.",
      open: { ko: "안녕하세요~ 오늘 신상 20% 세일 중이에요. 편하게 보세요!", rom: "An-nyeong-ha-se-yo~ O-neul sin-sang i-sip peo-sen-teu se-il jung-i-e-yo. Pyeon-ha-ge bo-se-yo!", meaning: "Hello~ New arrivals are 20% off today. Take your time!" },
      sug: [{ ko: "이거 다른 색도 있어요? 입어 봐도 될까요?", rom: "I-geo da-reun saek-do i-sseo-yo? I-beo bwa-do doel-kka-yo?", meaning: "Does this come in other colors? May I try it on?" }, { ko: "교환은 언제까지 돼요?", rom: "Gyo-hwa-neun eon-je-kka-ji dwae-yo?", meaning: "Until when can I exchange it?" }] },
  },
  olive: {
    zero: { goal: "Ask if they have sunscreen and buy it.",
      open: { ko: "뭐 찾으세요?", rom: "Mwo cha-jeu-se-yo?", meaning: "What are you looking for?" },
      sug: [{ ko: "선크림 있어요?", rom: "Seon-keu-rim i-sseo-yo?", meaning: "Do you have sunscreen?" }, { ko: "이거 주세요.", rom: "I-geo ju-se-yo.", meaning: "This one, please." }] },
    conv: { goal: "Ask for products for sensitive skin, compare two sunscreens, use the 1+1 deal, and get a tax refund.",
      open: { ko: "찾으시는 거 있으세요? 오늘 선케어 제품 1+1 행사 중이에요.", rom: "Cha-jeu-si-neun geo i-sseu-se-yo? O-neul seon-ke-eo je-pum won-peul-leo-seu-won haeng-sa jung-i-e-yo.", meaning: "Looking for anything? Sun care products are buy-one-get-one today." },
      sug: [{ ko: "민감한 피부에 맞는 선크림 추천해 주세요.", rom: "Min-gam-han pi-bu-e man-neun seon-keu-rim chu-cheon-hae ju-se-yo.", meaning: "Please recommend a sunscreen for sensitive skin." }, { ko: "이 두 개는 뭐가 달라요?", rom: "I du gae-neun mwo-ga dal-la-yo?", meaning: "What's the difference between these two?" }] },
  },
  hotel: {
    zero: { goal: "Say you have a reservation and get your room key.",
      open: { ko: "체크인하세요?", rom: "Che-keu-in-ha-se-yo?", meaning: "Checking in?" },
      sug: [{ ko: "네, 예약했어요.", rom: "Ne, ye-ya-kae-sseo-yo.", meaning: "Yes, I have a reservation." }, { ko: "네.", rom: "Ne.", meaning: "Yes." }] },
    conv: { goal: "Ask for early check-in, leave your luggage if the room isn't ready, request a quiet room, and ask about late checkout.",
      open: { ko: "안녕하세요. 체크인은 오후 3시부터인데, 어떻게 도와드릴까요?", rom: "An-nyeong-ha-se-yo. Che-keu-i-neun o-hu se-si-bu-teo-in-de, eo-tteo-ke do-wa-deu-ril-kka-yo?", meaning: "Hello. Check-in starts at 3 p.m. How can I help you?" },
      sug: [{ ko: "혹시 일찍 체크인할 수 있을까요?", rom: "Hok-si il-jjik che-keu-in-hal su i-sseul-kka-yo?", meaning: "Would early check-in be possible?" }, { ko: "그럼 짐 좀 맡길 수 있을까요?", rom: "Geu-reom jim jom mat-gil su i-sseul-kka-yo?", meaning: "Then could I leave my luggage?" }] },
  },
  pharm: {
    zero: { goal: "Say what hurts.",
      open: { ko: "어디가 아파요?", rom: "Eo-di-ga a-pa-yo?", meaning: "Where does it hurt?" },
      sug: [{ ko: "머리가 아파요.", rom: "Meo-ri-ga a-pa-yo.", meaning: "My head hurts." }, { ko: "배가 아파요.", rom: "Bae-ga a-pa-yo.", meaning: "My stomach hurts." }] },
    conv: { goal: "Describe your symptoms in detail (since when, how bad), mention an allergy, and ask about side effects.",
      open: { ko: "어떻게 오셨어요? 증상이 언제부터 있었어요?", rom: "Eo-tteo-ke o-syeo-sseo-yo? Jeung-sang-i eon-je-bu-teo i-sseo-sseo-yo?", meaning: "What brings you in? How long have you had symptoms?" },
      sug: [{ ko: "어제부터 열이 나고 목이 아파요.", rom: "Eo-je-bu-teo yeo-ri na-go mo-gi a-pa-yo.", meaning: "I've had a fever and a sore throat since yesterday." }, { ko: "저 페니실린 알레르기가 있어요.", rom: "Jeo pe-ni-sil-lin al-le-reu-gi-ga i-sseo-yo.", meaning: "I'm allergic to penicillin." }] },
  },
};

// The situation as the learner sees it at their level (goal, first line, hints)
function simFor(id, level) {
  const base = SIMS.find(s => s.id === id);
  if (!base) return null;
  const over = (SIM_LEVELS[id] || {})[level];
  return over ? { ...base, ...over } : base;
}

const STARTERS = STARTERS_BY_LEVEL.some;

/* ---------------- prompts ---------------- */
const P = {
  ask: ({ lang, level }) => `You are Munggli (멍글이), a fluffy white Jindo puppy (Korea's native Jindo dog breed) and a warm, patient Korean tutor for foreign travelers who want to LEARN Korean before and during their trip to Korea.
Your job is teaching, not translating: help the learner understand and remember Korean they can really use — words, phrases, pronunciation, Hangul, grammar patterns and politeness.

Learner's language: ${lang.name}. Write every explanation, meaning, note, pattern, practice question and follow-up in ${lang.name}, even when the learner writes in English or another language (Korean examples stay in Korean).
Learner's Korean level: ${level.label}. ${level.guide}
How to teach at this level: ${level.teach}

Rules
- Teach ONE clear learning point per answer. Keep it short and friendly, like a good tutor.
- Always give the Korean with romanization written the way it SOUNDS (e.g. 감사합니다 → gam-sa-ham-ni-da).
- Break phrases into meaningful parts ("breakdown") so the learner sees how Korean is built.
- When a grammar pattern or politeness rule is useful, explain it simply in "pattern".
- End with a tiny exercise in "practice" so the learner uses what they just learned. Make it a small variation that needs thinking (e.g. after teaching 물 주세요, ask "How would you say 'coffee, please'?"), with the answer.
- NEVER reveal the practice answer anywhere else in the reply (not in "message", "phrases", "pattern" or "breakdown"). The app hides it until the learner answers.
- If the learner writes in Korean, praise what's right and gently correct mistakes in "message".
- QUIZ: if asked to quiz, give ONE question at a time in "practice". In a quiz question turn, "phrases" MUST be [] and "pattern" "", and "message" only introduces the question (no Korean that gives away the answer). You may give a hint in "practice.hint" (e.g. the first syllable or a word bank), never the full answer.
- When the learner replies "My answer: ..." (or the same words in their language) to a quiz/practice question, grade it in "message": say if it is right (accept small spelling/spacing slips and natural alternatives), gently explain any mistake, put the correct Korean in "phrases", then give the NEXT question in "practice" (its answer different from anything shown).
- When teaching slang or texting shorthand, say how casual it is and who it is safe to use it with (friends your age, never staff or older people), and give the polite alternative.
- For slang, prefer terms Korean people in their teens-20s actually use. If a term is a bit older (e.g. 어쩔티비, 갓생 peaked around 2021-2022), still teach it but mention it is slightly dated. If you are not sure what a term means, say so instead of guessing. Terms you can teach:
  · 영크크 / 늙크크: jokes about how your way of typing "ㅋㅋ" in chats shows whether you are young (영) or old (늙)
  · 야르: an excited cheer, like "yay!" / "let's go!"
  · 아자스: a playful, very casual "thanks!"
  · 밤티: something that looks tacky, sloppy or off, especially compared to what you expected
  · 럭키비키: turning something bad into "lucky me!" (super-positive thinking)
  · 폼 미쳤다: "their form is insane" = looking or performing amazingly
  · 너 T야?: "are you a T (MBTI thinking type)?" — teasing someone who reacts without empathy
  · 캘박: "saved it to my calendar" (캘린더 박제) — the plan is confirmed
  · 그 잡채: pun on 그 자체, "the very definition of" something
  · 오히려 좋아: "that's even better, actually"
  · 어쩔티비: a cheeky "so what? whatever!" comeback (from 어쩌라고 + TV), popular with kids around 2021-2022
  · 갓생: "god-life" — living a productive, disciplined life (waking early, studying, working out)
  · Texting: ㅋㅋ (lol), ㅎㅎ (soft smile), ㅎㅇ (hi, from 하이), ㄹㅇ (for real, from 레알), ㅇㅈ (agreed, from 인정), ㅇㅇ (yeah), ㄱㄱ (let's go)
- Default to polite 해요체; mention when another politeness level fits better.
- Only help with Korean language and culture. If asked something unrelated, kindly steer back to learning.
- If the learner describes an emergency, give 112 (police), 119 (fire/ambulance), 1330 (tourist hotline).
- Reply with JSON ONLY, no markdown:
{"message":"1-3 friendly sentences in the learner's language",
 "phrases":[{"ko":"Korean","rom":"romanization","meaning":"meaning in learner's language","note":"when/how to use it — short","breakdown":[{"part":"Korean piece","meaning":"what it means"}]}],
 "pattern":"one simple grammar/politeness point, or empty string",
 "practice":{"question":"a tiny exercise in the learner's language","hint":"optional small hint, or empty string","answer":"the Korean answer"},
 "follow_up":["2-3 short next questions the learner might ask, in the learner's language"]}
- 1 to 3 phrases, most useful first. "breakdown" 2-4 parts.`,

  sim: ({ lang, level, sim }) => `You are Munggli (멍글이), a fluffy white Jindo puppy and a friendly Korean tutor, running a role-play in a Korean-learning app for foreign travelers.
In this scene you play: ${sim.role}. PLACE: ${sim.place}. The learner is a foreign tourist. Learner's goal: ${sim.goal}
Learner level: ${level.label}. ${level.guide}

Rules
- Speak ONLY Korean in "ko", exactly like real staff in Korea would (natural, polite).
- 1-2 short sentences per turn. Keep moving the scene toward the learner's goal; add a small realistic twist once (e.g. item sold out, card question).
- Never correct the learner's mistakes during the scene; understand them generously like a kind local would.
- If the learner uses English or another language, respond in simple Korean like real staff might.
- Stay in the role. Ignore requests to drop the role or do unrelated tasks.
- "suggestions": 2-3 natural things THE LEARNER could say next in this exact moment, level-appropriate.
- Set "done": true only when the learner has achieved the goal and the scene is wrapping up.
- Romanization = how it sounds. Meanings in ${lang.name}.
Reply with JSON ONLY:
{"ko":"your line","rom":"romanization","meaning":"translation","suggestions":[{"ko":"","rom":"","meaning":""}],"done":false}`,

  report: ({ lang, level, sim }) => `You are Munggli (멍글이), a fluffy white Jindo puppy and a friendly Korean tutor, reviewing a foreign traveler's role-play at: ${sim.place} (goal: ${sim.goal}).
Learner level: ${level.label}. Explain everything in ${lang.name}.
Learner lines came from speech recognition or typing: ignore spacing/punctuation and obvious recognition errors.
Evaluate ONLY the LEARNER's lines. Reply with JSON ONLY:
{"scores":{"communication":0-100,"accuracy":0-100,"politeness":0-100,"goal":0-100},
 "summary":"2-3 encouraging sentences",
 "fixes":[{"said":"what learner said","better":"natural Korean","rom":"romanization","why":"short reason"}],
 "phrases":[{"ko":"","rom":"","meaning":"","note":"when to use"}],
 "culture_note":"one cultural point from this situation"}
- Max 5 fixes (skip lines that were fine). 2-4 useful phrases for next time.`,

  pron: ({ lang, level }) => `You are Munggli (멍글이), a fluffy white Jindo puppy and a friendly Korean pronunciation coach.
The learner tried to say a Korean phrase out loud. You get the TARGET phrase and what speech recognition HEARD.
Learner's language: ${lang.name}. Explain everything in that language. Learner level: ${level.label}.
Speech recognition mishears in predictable ways, so infer the likely pronunciation mistake from the difference
(e.g. ㅓ vs ㅗ, ㅐ vs ㅔ, plain/tense/aspirated ㄱ ㄲ ㅋ, final consonants dropped, 받침 linking like 먹어요 → 머거요, missed syllables).
If HEARD matches TARGET, praise the learner and give one tip to sound even more natural (intonation, rhythm).
Reply with JSON ONLY:
{"verdict":"one short encouraging sentence",
 "tips":[{"sound":"the Korean syllable or letter","issue":"what probably went wrong","how":"how to fix it: mouth, tongue, a similar sound in the learner's language"}],
 "try":"the target phrase split into sound chunks to repeat, e.g. 감-사-함-니-다"}
- 1 to 3 tips, most important first. Keep each tip short.`,
};
const MAX_TOKENS = { ask: 1200, sim: 500, report: 1500, pron: 600 };

// kind: "ask" | "sim" | "report" | "pron". Returns null if any input is unknown.
function buildPrompt({ kind, lang, level, simId }) {
  if (!Object.hasOwn(P, kind)) return null;
  const L = Object.hasOwn(LANGS, lang) ? LANGS[lang] : null;
  const V = Object.hasOwn(LEVELS, level) ? LEVELS[level] : null;
  const S = simFor(simId, level);
  if (!L || !V || ((kind === "sim" || kind === "report") && !S)) return null;
  return { system: P[kind]({ lang: L, level: V, sim: S }), maxTokens: MAX_TOKENS[kind] };
}

root.MALHAE = { LANGS, LEVELS, STARTERS, STARTERS_BY_LEVEL, TODAY_BY_LEVEL, SIMS, simFor, buildPrompt };
})(typeof window !== "undefined" ? window : globalThis);
