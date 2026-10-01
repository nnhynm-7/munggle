# Munggle (멍글) — 한국 여행 온 외국인을 위한 AI 한국어 선생님

에크크(AI Creator Crew) · HUSS AI BRIDGE「AI 융합 커뮤니티」 프로젝트

## 타깃 & 차별점

- **타깃**: 한국을 여행·방문하는 외국인 (한국어 먼저 → 이후 다른 언어로 확장)
- **ChatGPT와 다른 점**: 일반적인 번역이 아니라, **"지금 내 상황에서 뭐라고 말하면 되는지"**를 현지인 관점(존댓말 수준, 문화 팁, 발음)으로 추천하고, 바로 **소리 내어 연습 → 발음 점수**까지 이어짐

## 기능 (탭 3개)

| 탭 | 내용 |
|---|---|
| **Ask Munggli (멍글이)** (대화형 학습) | 내 상황을 내 언어로 말하거나 입력 → AI 선생님 '멍글이'(진돗개)가 상황에 맞는 한국어 표현(발음 표기·뜻·사용 팁)과 현지 팁을 추천. 표현마다 듣기 / 천천히 듣기 / 발음 연습 / 저장 |
| **Situation Simulator** (상황 시뮬레이션) | 고깃집·편의점·택시·지하철·카페·명동 쇼핑·게스트하우스·약국 8개 상황. 직원 역할 AI가 한국어로만 말하고, 화면 아래에 "지금 할 수 있는 말" 힌트 제시. 끝나면 점수·교정·문화 노트 리포트 |
| **My Phrases** (표현 노트) | 저장한 표현 모음, 플래시카드 복습, 발음 연습 |

- **마이크**: 모든 탭에서 사용 가능. Ask 탭은 "내 언어로 말하기 / 한국어로 말하기" 전환, 시뮬레이션은 한국어 인식. **Hands-free** 켜면 직원이 말한 뒤 자동으로 마이크가 켜져 실제 대화처럼 이어짐
- **발음 연습**: 목표 문장과 인식된 문장을 음절 단위로 비교해 점수(%)와 틀린 글자 표시
- **설정**: 설명 언어(영어·일본어·중국어·스페인어), 한국어 수준(처음·조금·회화 가능)

## 실행 방법 (음성 기능 포함 전체 버전)

필요한 것: **Node.js 20.12 이상**, **Chrome 또는 Edge**

```bash
cd ai-conversation-coach
npm start
```

→ http://localhost:3000 접속. (`npm install` 필요 없음)

- API 키가 없으면 **데모 모드**(예시 답변)로 동작 → 디자인·흐름 테스트용
- 실제 AI: `.env.example`을 `.env`로 복사하고 키 입력 후 재시작
  - **무료:** Google Gemini — https://aistudio.google.com/apikey 에서 키 발급 → `LLM_PROVIDER=gemini`, `GEMINI_API_KEY`
  - 유료: Claude(`ANTHROPIC_API_KEY`) / OpenAI(`LLM_PROVIDER=openai`, `OPENAI_API_KEY`)
- ⚠️ `.env`(API 키)는 GitHub에 올리지 말 것 (`.gitignore`에 포함됨)

## 인터넷에 배포하기 (Render, 무료)

마이크는 **https 주소**에서만 동작하므로, 실제 사용자에게 쓰게 하려면 배포가 필요합니다.

1. 이 폴더를 GitHub 저장소에 올린다 (`.env`는 자동으로 제외됨)
2. [render.com](https://render.com) 로그인 → **New → Blueprint** → 저장소 선택 (`render.yaml`을 자동으로 읽음)
3. `ANTHROPIC_API_KEY` 값을 입력하고 배포 → `https://malhae-xxxx.onrender.com` 주소가 생김

비용 보호 장치 (`.env` 또는 Render 환경변수로 조절):

| 변수 | 기본값 | 의미 |
|---|---|---|
| `RATE_PER_MINUTE` | 20 | 사용자(IP)당 1분 요청 수 |
| `DAILY_LIMIT` | 1000 | 서버 전체 하루 AI 호출 수. 넘으면 다음날까지 안내 메시지 |
| `TRUST_PROXY` | 0 (Render는 1) | 프록시 뒤에서 사용자 IP를 제대로 구분 |

> `DAILY_LIMIT`가 하루 비용의 상한 역할을 합니다. 그래도 Anthropic 콘솔(Billing → Limits)에서 월 사용 한도를 꼭 따로 걸어두세요.
>
> 무료 플랜은 15분간 접속이 없으면 잠들어서, 첫 접속이 30초쯤 걸릴 수 있어요.

## 웹 미리보기 버전

`public/app.html`은 Claude 아티팩트 링크로도 열리는 버전이 있어요(키 없이 AI 동작). 단, 그 환경에서는 브라우저 정책상 **마이크가 막혀 있어서 텍스트 입력만** 가능하고, 음성 기능은 위의 전체 버전에서 사용합니다.

## 폴더 구조

```
ai-conversation-coach/
├─ server.js         # 화면 제공 + AI 중계(/api/llm). API 키는 여기에만 있음
├─ render.yaml       # Render 배포 설정
├─ .env.example      # API 키·요청 제한 설정 예시
└─ public/
   ├─ app.html       # 화면·디자인·기능 (홈 화면, 멍글이 캐릭터 포함)
   ├─ shared.js      # 상황·예시 질문·AI 프롬프트 (브라우저와 서버가 같이 씀)
   └─ sounds.js      # 멍글이 누르는 소리 (팀이 직접 녹음한 말랑이 소리 2개, 누를 때마다 번갈아 랜덤 재생)
```

## 어디를 고치면 되나요?

| 하고 싶은 것 | 찾을 곳 |
|---|---|
| 색·글꼴 | `app.html` 맨 위 `<style>`의 `:root` 변수 (상황별 색 = 서울 지하철 노선 색) |
| 상황 추가/수정 | `shared.js`의 `const SIMS = [...]` (첫 대사, 힌트, 목표) |
| 첫 화면 예시 질문 | `shared.js`의 `const STARTERS = [...]` |
| AI 말투·규칙·피드백 항목 | `shared.js`의 `const P = { ask, sim, report }` 프롬프트 |
| 설명 언어 추가 | `shared.js`의 `const LANGS` + `app.html` 상단 `<select id="prefLang">` |
| 데모 답변 | `app.html`의 `const MOCK` |

> 프롬프트는 서버가 `shared.js`에서 직접 만들어 씁니다. 브라우저는 "어떤 기능(kind)·언어·수준·상황"만 보내므로, 외부인이 서버를 다른 용도의 AI로 악용할 수 없어요.

## 다음 단계 아이디어

- 배포(Render/Railway 등) → https 주소로 누구나 접속 + 마이크 사용
- 발음 평가 API(Azure 등)로 억양까지 평가
- 로그인 + DB로 학습 기록 저장, 여행 일정에 맞춘 추천(예: 내일 명동 → 쇼핑 표현)
- 한국 문화 콘텐츠 확장(식사 예절, 나이·존댓말, 지역 방언 등), 다른 언어 학습으로 확장
