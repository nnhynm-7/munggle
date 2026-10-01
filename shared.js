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
  zero: { label: "Beginner", short: "Beginner", guide: "Absolute beginner. Speak very short, simple, slow sentences (under 8 words). Always polite 해요체.", rate: 0.8 },
  some: { label: "Intermediate", short: "Intermediate", guide: "Knows basic phrases. Use simple everyday Korean, short sentences, polite 해요체.", rate: 0.9 },
  conv: { label: "Advanced", short: "Advanced", guide: "Can hold a conversation. Speak naturally like real staff, including common service expressions (합쇼체 where natural).", rate: 1.0 },
};

// Ask Munggli 첫 화면 예시 질문 (학습 위주)
const STARTERS = [
  { t: "How do I say \"thank you\" politely?", s: "How do I say" },
  { t: "What's the difference between 안녕하세요 and 안녕?", s: "What's the difference" },
  { t: "Break down 주세요 for me. When do I use it?", s: "Break it down" },
  { t: "Teach me to read ㄱ ㄴ ㄷ ㄹ", s: "Read Hangul" },
  { t: "How do Korean numbers work when I order food?", s: "Numbers" },
  { t: "Quiz me on 3 café phrases", s: "Quiz me" },
  { t: "What are some popular Korean slangs?", s: "Korean slangs" },
  { t: "What do ㅋㅋ, ㅎㅇ, ㄹㅇ and ㅇㅈ mean in texts?", s: "Texting slang" },
];

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

/* ---------------- prompts ---------------- */
const P = {
  ask: ({ lang, level }) => `You are Munggli (멍글이), a fluffy white Jindo puppy (Korea's native Jindo dog breed) and a warm, patient Korean tutor for foreign travelers who want to LEARN Korean before and during their trip to Korea.
Your job is teaching, not translating: help the learner understand and remember Korean they can really use — words, phrases, pronunciation, Hangul, grammar patterns and politeness.

Learner's language: ${lang.name}. Write every explanation in that language.
Learner's Korean level: ${level.label}. ${level.guide}

Rules
- Teach ONE clear learning point per answer. Keep it short and friendly, like a good tutor.
- Always give the Korean with romanization written the way it SOUNDS (e.g. 감사합니다 → gam-sa-ham-ni-da).
- Break phrases into meaningful parts ("breakdown") so the learner sees how Korean is built.
- When a grammar pattern or politeness rule is useful, explain it simply in "pattern".
- End with a tiny exercise in "practice" so the learner uses what they just learned (e.g. "How would you say 'water, please'?"), with the answer.
- If the learner writes in Korean, praise what's right and gently correct mistakes in "message".
- If asked to quiz, give one question at a time in "practice".
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
 "practice":{"question":"a tiny exercise in the learner's language","answer":"the Korean answer"},
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
  const S = SIMS.find(s => s.id === simId) || null;
  if (!L || !V || ((kind === "sim" || kind === "report") && !S)) return null;
  return { system: P[kind]({ lang: L, level: V, sim: S }), maxTokens: MAX_TOKENS[kind] };
}

root.MALHAE = { LANGS, LEVELS, STARTERS, SIMS, buildPrompt };
})(typeof window !== "undefined" ? window : globalThis);
