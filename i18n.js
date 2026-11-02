/* =========================================================
   달빛암 English mode
   - 한국어 화면 글자를 그대로 두고, 영어 모드일 때 화면에 나타나는 글자를 바로바로 바꿔요
   - 언어: ?lang=en 주소 → 저장된 선택 → 브라우저 언어 순서로 정해요
   ========================================================= */
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
const qs = new URLSearchParams(location.search).get("lang");
if (qs === "en" || qs === "ko") store.set("dalbitam-lang", qs);
// 휴대폰 · 컴퓨터 언어 목록에 한국어가 하나라도 있거나, 한국 시간대면 한국어로 열어요 (영어 OS를 쓰는 한국 사람도 많아서)
const koEnv = (() => { try { const ls = [...(navigator.languages || []), navigator.language || ""].map((l) => l.toLowerCase()); if (ls.some((l) => l.startsWith("ko"))) return true; return /Seoul/.test(Intl.DateTimeFormat().resolvedOptions().timeZone || ""); } catch { return true; } })();
const LANG = (qs === "en" || qs === "ko") ? qs : store.get("dalbitam-lang") || (koEnv ? "ko" : "en");
window.LANG = LANG;
document.documentElement.lang = LANG;
window.setLang = (l) => { store.set("dalbitam-lang", l); const u = new URL(location.href); u.searchParams.set("lang", l); location.href = u.toString(); };

/* 한글 → 로마자 (경문을 소리 나는 대로 따라 읽을 수 있게, 받침 연음은 단순하게) */
const CHO = ["g", "kk", "n", "d", "tt", "r", "m", "b", "pp", "s", "ss", "", "j", "jj", "ch", "k", "t", "p", "h"];
const JUNG = ["a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa", "wae", "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i"];
const JONG = ["", "k", "k", "k", "n", "n", "n", "t", "l", "k", "m", "l", "l", "l", "p", "l", "m", "p", "p", "t", "t", "ng", "t", "t", "k", "t", "p", "t"];
window.romanize = (s) => [...String(s)].map((ch) => { const c = ch.charCodeAt(0) - 0xac00; if (c < 0 || c > 11171) return ch === " " ? "  " : ch;
  const cho = Math.floor(c / 588), jung = Math.floor((c % 588) / 28), jong = c % 28; return (CHO[cho] + JUNG[jung] + JONG[jong]); }).join("-").replace(/- {2}-/g, " ").replace(/^-|-$/g, "");

const D = {
  // 입장 · 위쪽
  "목탁 한 번, 숨 한 번.": "One moktak strike, one breath.", "잠시 마음을 내려놓고 쉬어 가세요.": "Set your mind down and rest a while.",
  "법명": "Dharma name", "예: 고요": "e.g. Stillness", "입장하기": "Enter the temple", "법명 새로 짓기": "New dharma name",
  "눌러 이동 · 끌어서 둘러보기 · 두 손가락으로 확대": "Tap to walk · drag to look around · pinch to zoom",
  "달빛암 3D 화면": "Dalbitam 3D view", "염불": "Chant", "염불 끄기": "Stop chant", "혼자 수행 중": "Practicing alone", "월하당": "Moonlight Hall",
  "법복 꾸미기": "Dress up", "자연 소리 설정": "Sound settings", "수행 등급과 오늘의 수행": "Rank and today's practice",
  "대화하기": "Chat", "표정 짓기": "Expressions", "장소 이동": "Go to",
  // 장소
  "마당": "Courtyard", "대웅전": "Main Hall", "석탑": "Stone Pagoda", "산신각": "Mountain Spirit Shrine", "칠성각": "Seven Stars Shrine", "관음전": "Guanyin Hall",
  "지장전": "Jizo Hall", "공양간": "Temple Kitchen", "산책길": "Forest Path", "달빛봉": "Moon Peak", "기념품": "Gift Shop", "기념품 가게": "Gift Shop", "산길": "Mountain Trail", "정상": "Summit", "법당": "Shrine Room", "산신각·칠성각": "Shrines",
  // 장소 안내
  "마당에 들어왔어요. 가고 싶은 곳을 눌러 걸어가 보세요.": "You're in the courtyard. Tap anywhere to walk there.",
  "부처님 앞이에요. 목탁을 치고 절을 올려 보세요.": "You're before the Buddha. Strike the moktak and offer a bow.",
  "석탑을 천천히 돌며 소원을 떠올려 보세요.": "Walk slowly around the pagoda and hold a wish in your heart.",
  "오늘의 공양을 골라 보세요. 차도 한 잔 있어요.": "Choose today's temple meal. There's tea, too.",
  "물소리 들리는 숲길이에요. 서쪽으로 가면 달빛봉이 있어요.": "A forest path by the stream. Moon Peak lies to the west.",
  "디딤돌을 따라 한 걸음씩 올라가 보세요.": "Follow the stepping stones, one step at a time.",
  "정상이에요! 달빛암이 한눈에 내려다보여요.": "The summit! All of Dalbitam lies below you.",
  "수행하며 모은 복전으로 기념품을 골라 보세요.": "Spend the merit coins you've earned on keepsakes.",
  "산신각이에요. 들어가서 산왕경을 함께 읽어 보세요.": "The Mountain Spirit Shrine. Go in and chant the Mountain King Sutra.",
  "칠성각이에요. 들어가서 칠성경을 함께 읽어 보세요.": "The Seven Stars Shrine. Go in and chant the Seven Stars Sutra.",
  "관음전이에요. 들어가서 반야심경을 함께 읽어 보세요.": "Guanyin Hall. Go in and chant the Heart Sutra.",
  "지장전이에요. 먼저 떠나신 분들을 위해 기도해요.": "Jizo Hall. Pray here for those who have passed.",
  "산신께 산의 기운을 빌어요. 산왕경을 함께 읽어 보세요.": "Ask the Mountain Spirit for strength. Chant along.",
  "북두칠성께 건강과 복을 빌어요. 칠성경을 함께 읽어 보세요.": "Ask the Big Dipper for health and blessings. Chant along.",
  "관세음보살께 마음의 평화를 빌어요. 반야심경을 함께 읽어 보세요.": "Ask Guanyin for peace of mind. Chant the Heart Sutra.",
  "지장보살께 먼저 떠나신 분들의 평안을 빌어요.": "Ask Jizo Bodhisattva for peace for those who have passed.",
  // 행동 버튼
  "방석 앉기": "Sit", "일어나기": "Stand", "계속 절하기": "Keep bowing", "멈추기": "Stop", "목탁": "Moktak", "향": "Incense", "공양미": "Rice offering",
  "예불 듣기": "Evening chant", "예불 끄기": "Stop chant", "합장": "Bow", "염주": "Prayer beads", "탑돌이": "Circle pagoda", "소원 연등": "Wish lantern",
  "기와 소원": "Roof-tile wish", "범종 치기": "Ring bell", "풍경": "Wind bell", "초 켜기": "Light candle", "공양 고르기": "Choose meal", "차 마시기": "Drink tea",
  "가게 둘러보기": "Browse shop", "계곡 소리": "Stream sounds", "달빛봉 오르기": "Climb Moon Peak", "정상까지 오르기": "Climb to summit", "바람 소리": "Wind sounds",
  "칠성기도": "Seven Stars prayer", "기도 멈추기": "Stop prayer", "경치 보기": "View", "내려가기": "Descend", "기도하기": "Pray", "절": "Bow down", "나가기": "Leave", "딸깍": "Click",
  // 패널 제목 · 공통
  "닫기": "Close", "법당 고르기": "Choose a hall", "오늘의 공양": "Today's meal", "오늘의 수행": "Today's practice", "수행 등급": "Ranks", "홈 화면에 추가하기": "Add to home screen",
  "설정 · 자연 소리": "Settings · Sounds", "소리 출처": "Sound credits", "바람": "Wind", "계곡물": "Stream", "새소리": "Birds", "목탁·종": "Moktak & bell",
  "🎬 촬영 모드 (화면 글자 숨기기)": "🎬 Recording mode (hide UI)", "📲 앱처럼 홈 화면에 추가하기": "📲 Add to home screen like an app",
  "← 돌아가기": "← Back", "첫 번째 바퀴": "Round 1", "염주 한 알 넘기기": "Move one bead", "📿 내 염꾸로": "📿 Use my beads", "📿 기본 염주로": "📿 Use default beads",
  "보내기": "Send", "말풍선 끄기": "Hide bubbles", "말풍선 켜기": "Show bubbles", "월하당 대화": "Hall chat", "같은 법당 사람들에게 한마디 (40자)": "Say something to people here (40 chars)",
  "대화는 저장되지 않고, 지금 같은 법당에 있는 사람에게만 보여요.": "Chat isn't saved and only people here right now can see it.",
  "고른 모습은 같은 법당 사람들에게도 그대로 보여요.": "Everyone here sees the look you choose.", "바꾸기": "Change",
  "어느 법당에서도 같은 절을 이용할 수 있어요. 숫자는 실제 접속자 수예요.": "Every hall has the same temple. Numbers are real visitors.",
  "지금 달빛암에 함께 있는 사람이에요. 숫자는 실제 접속자 수예요.": "People at Dalbitam right now. These are real visitors.", "명이 함께 수행하고 있어요": "people practicing together",
  "추가하면 휴대폰 홈 화면에 달빛암 아이콘이 생기고, 누르면 앱처럼 전체 화면으로 열려요.": "Adds a Dalbitam icon to your home screen that opens full-screen like an app.",
  "일부 소리는 길이를 자르고 음량을 맞춰 사용했어요. 출처: gongu.copyright.or.kr": "Some sounds were trimmed and level-matched. Source: gongu.copyright.or.kr",
  // 수행 · 등급
  "미션 하나를 마치면 공덕이 오르고, 세 개 모두 마치면 추가 공덕을 얻습니다.": "Each mission raises your merit; finish all three for bonus merit.", "미션은 매일 자정에 바뀝니다.": "Missions change every midnight.",
  "등급이 오르면 이름 앞에 등급이 붙고 털모자 · 삿갓 · 연꽃 소품이 열려요. 스님부터는 머리 뒤에 후광이 생기고, 큰스님 · 도인이 되면 더 밝게 빛나요.": "Ranking up adds a title to your name and unlocks a beanie, straw hat and lotus. From Monk you get a halo, which glows brighter for Great Monk and Sage.",
  "동자": "Novice", "행자": "Postulant", "수행자": "Practitioner", "스님": "Monk", "큰스님": "Great Monk", "도인": "Sage", "· 공덕": "· merit",
  "목탁 30번 치기": "Strike the moktak 30 times", "절 30번 올리기": "Bow 30 times", "탑돌이 한 바퀴": "Circle the pagoda once", "합장 인사 3번": "Bow to others 3 times",
  "향 피우기": "Light incense", "공양간에서 차 마시기": "Drink tea in the kitchen", "소원 연등 달기": "Hang a wish lantern", "산책길 걷기": "Walk the forest path",
  "누군가에게 말 걸기": "Talk to someone", "염주 한 바퀴 돌리기": "One full round of beads", "법당이나 달빛봉에서 기도 1독": "Chant one full prayer", "범종 3번 치기": "Ring the bell 3 times",
  "달빛봉 정상 오르기": "Reach Moon Peak summit", "부처님께 공양미 올리기": "Offer rice to the Buddha", "기와에 소원 적기": "Write a roof-tile wish",
  "🌕 오늘의 수행을 모두 마쳤어요! (🪙50)": "🌕 All of today's practice done! (🪙50)",
  // 상점 · 꾸미기
  "복전은 수행할 때마다 쌓이고, 108배를 마치면 108닢을 한꺼번에 받아요.": "Merit coins build up as you practice. Finish 108 bows for 108 coins at once.",
  "진짜 굿즈": "Real goods", "진짜 굿즈는 준비 중이에요": "Real goods coming soon", "108배 인증 할인 쿠폰": "108-bow discount coupon", "🛒 진짜 굿즈 보러 가기": "🛒 See real goods",
  "착용하기": "Wear", "착용 중": "Wearing", "꾸미기": "Customize", "미니 목탁": "Mini moktak", "연등": "Lantern", "꽃 화관": "Flower crown", "선글라스": "Sunglasses",
  "손풍경": "Hand wind bell", "목탁 클리커": "Moktak clicker", "팔찌 염주": "Bead bracelet", "염꾸 염주": "Custom beads", "목걸이 염주": "Bead necklace", "털모자": "Beanie", "삿갓": "Straw hat", "연꽃": "Lotus", "없음": "None",
  "허리춤에 차는 미니 목탁": "A mini moktak for your belt", "손에 드는 작은 연등": "A little lantern to carry", "머리에 쓰는 들꽃 화관": "A wildflower crown",
  "깨달음의 선글라스": "Sunglasses of enlightenment", "손에 드는 풍경. 걸을 때마다 딸랑딸랑": "A hand wind bell that jingles as you walk",
  "어디서든 '딸깍' 누르는 목탁 클리커": "A moktak clicker you can click anywhere", "손목에 차는 단주 팔찌": "A short prayer-bead bracelet",
  "염꾸: 알 색과 이니셜을 골라 만드는 나만의 팔찌": "Design your own bracelet with colors and initials",
  "📿 염꾸 · 나만의 염주 꾸미기": "📿 Design your own prayer beads", "이 색으로 전체 칠하기": "Paint all beads this color", "십이지신 (맨 아래 장식 알)": "Zodiac charm (bottom bead)",
  "그림": "Picture", "한자": "Hanja", "이니셜 (영문 · 숫자, 최대 6자)": "Initials (letters or numbers, up to 6)", "예: HELEN": "e.g. HELEN", "지우기": "Clear",
  "만들어서 착용하기": "Make & wear", "이대로 착용하기": "Wear as is",
  "완성한 염꾸는 손목에 차고 다니고, 염주 돌리기에서도 이 염주로 돌려요. 같은 법당 사람들에게도 보여요.": "You'll wear it on your wrist and use it in the bead counter. Others can see it too.",
  "알을 누르면 그 알만 색을 바꿀 수 있어요. 아무 알도 안 고르면 전체가 바뀌어요.": "Tap a bead to color just that one. With none selected, all beads change.",
  "표정": "Face", "얼굴색": "Skin", "법복": "Robe", "가사": "Sash", "소품": "Accessory", "기념품 가게에서 살 수 있어요": "Available in the gift shop",
  // 공양
  "처음 먹어 보는 공양은 도감에 담겨요.": "New dishes go in your collection.",
  "비빔밥": "Bibimbap", "연잎밥": "Lotus-leaf rice", "산채나물밥": "Mountain greens rice", "미역국 한 상": "Seaweed soup set", "두부조림": "Braised tofu", "연근조림": "Braised lotus root",
  "버섯들깨탕": "Mushroom perilla soup", "새알 팥죽": "Red bean porridge", "감자전": "Potato pancake", "약과와 식혜": "Yakgwa & sikhye",
  // 연등 · 기와
  "새로 단 연등은 불이 꺼진 채로 걸려요. 대웅전에서 108배를 올리면 내 연등에 불이 켜져요.": "New lanterns hang unlit. Do 108 bows in the Main Hall to light yours.",
  "소원을 적어 주세요 (40자)": "Write your wish (40 chars)", "달기": "Hang", "연등 종류": "Lantern type", "황금등": "Gold lantern", "지혜등": "Wisdom lantern", "건강등": "Health lantern",
  "인연등": "Love lantern", "소망등": "Hope lantern", "재물 · 사업 · 금전운": "Wealth · business · fortune", "합격 · 학업 · 취업 · 승진": "Exams · study · jobs · promotion",
  "건강 · 가족의 평안": "Health · family peace", "사랑 · 결혼 · 좋은 인연": "Love · marriage · good ties", "그 밖의 모든 소원": "Every other wish",
  "아직 걸린 연등이 없어요. 첫 소원을 달아 보세요.": "No lanterns yet. Hang the first wish!", "🙇 108배 하러 가기": "🙇 Go do 108 bows", "보러 가기": "Go see", "내 연등": "My lantern",
  "불 꺼짐": "unlit", "· 불 꺼짐": "· unlit", "불 밝힘": "lit", "아직 불이 꺼져 있어요": "still unlit", "108배를 올리면 불이 켜져요": "lights up after 108 bows",
  "🏮 소원 연등을 달면, 다음 108배 때 내 연등에 불이 켜져요": "🏮 Hang a wish lantern and your next 108 bows will light it",
  "기와 불사": "Roof-tile offering", "기와에 적을 소원 (20자)": "Wish for your roof tile (20 chars)", "올리기": "Offer", "기와를 누르면 적힌 소원을 볼 수 있어요.": "Tap a tile to read its wish.",
  "절에서 지붕을 새로 이을 때 쓰는 기와에 소원을 적어 올려요. 법당 앞 너럭바위의 기와 단에 쌓여 모두에게 보여요.": "Write a wish on a roof tile, like temples do when re-roofing. It's stacked on the tile stand in front of the hall for all to see.",
  "아직 올라간 기와가 없어요. 첫 기와에 소원을 적어 보세요.": "No tiles yet. Write the first wish!", "🏯 기와에 소원을 적어 올렸어요": "🏯 Your roof-tile wish is up",
  "기와를 올렸어요. 법당 앞 너럭바위 기와 단에서 볼 수 있어요.": "Tile offered. Find it on the stand in front of the hall.", "소원을 적어 주세요": "Write your wish",
  // 기도
  "🙏 기도 시작": "🙏 Start prayer", "🙏 이어서 기도하기": "🙏 Continue prayer", "⏸️ 잠시 멈추기": "⏸️ Pause", "기도 시작을 누르면 목탁 박자에 맞춰 한 글자씩 읽어요": "Press Pray to chant one syllable per moktak beat",
  "산왕경": "Mountain King Sutra", "칠성경": "Seven Stars Sutra", "반야심경": "Heart Sutra", "지장보살 찬탄": "Praise to Jizo", "축원": "Dedication", "달빛봉 칠성기도 · 칠성경": "Moon Peak · Seven Stars Sutra",
  "탐랑": "Tamnang", "거문": "Geomun", "녹존": "Nokjon", "문곡": "Mungok", "염정": "Yeomjeong", "무곡": "Mugok", "파군": "Pagun",
  // 알림
  "🪙 108배 완료! 복전 108닢을 받았어요. 기념품 가게에 들러 보세요": "🪙 108 bows done! You got 108 merit coins. Visit the gift shop.",
  "오늘 108배를 모두 마쳤어요. 정말 수고했어요.": "You finished all 108 bows today. Well done.", "향 연기가 천천히 피어올라요.": "Incense smoke rises slowly.",
  "방석에 앉았어요. 숨을 고르고 절을 올려 보세요.": "You sit on the cushion. Breathe, then bow.", "천천히 절을 올리는 중이에요. 멈추려면 한 번 더 눌러요.": "Bowing slowly. Tap again to stop.",
  "방석에 앉아 '계속 절하기'를 누르면 108배를 올려요": "Sit on a cushion and tap 'Keep bowing' to do 108 bows", "빈 방석이 없어요": "No empty cushion",
  "시계 방향으로 천천히 탑을 돌아요.": "Circling the pagoda slowly, clockwise.", "물소리와 새소리를 들으며 천천히 걸어 보세요.": "Walk slowly with the stream and the birds.",
  "저녁 예불 소리예요. 범종 · 목어 · 운판 · 목탁이 차례로 울려요.": "Evening service: the bell, wooden fish, cloud gong and moktak sound in turn.",
  "땡그랑— 처마 끝 풍경 소리가 맑게 퍼져요.": "Ting— the wind bell rings clear from the eaves.", "가장 가까운 처마의 풍경을 울렸어요. 처마 끝 풍경을 직접 눌러도 돼요": "Rang the nearest wind bell. You can tap bells on the eaves too.",
  "부처님 앞에 공양미를 올렸어요. 나눔의 마음이 쌓여요.": "You offered rice to the Buddha. Generosity grows.",
  "화면을 끌면 법당 안을 둘러볼 수 있어요. 두 손가락으로 가까이 · 멀리": "Drag to look around the hall. Pinch to zoom.",
  "염주 한 바퀴, 108번의 마음을 모았어요.": "One full round: 108 moments of mindfulness.", "소리가 나지 않으면 무음 모드를 끄고 음량을 올려 주세요": "No sound? Turn off silent mode and raise the volume.",
  "연결이 불안정해 혼자 수행 모드로 열었어요.": "Connection is unstable, so you're practicing solo.", "고운 말로 적어 주세요.": "Please use kind words.", "고운 말로 이야기해 주세요": "Please use kind words.",
  "연등을 걸지 못했어요. 잠시 뒤 다시 시도해 주세요.": "Couldn't hang the lantern. Please try again.", "지금은 연등이 이 기기에만 저장돼요.": "Lanterns are saved on this device only for now.",
  "저 아래 대웅전과 석탑, 연등이 보여요. 두 손가락으로 다시 가까이 볼 수 있어요.": "Below you: the Main Hall, the pagoda and lanterns. Pinch to zoom back in.",
  "조심조심 잘 내려왔어요.": "You made it down safely.", "천천히 내려가요.": "Going down slowly.", "정상 도착!": "Summit!", "디딤돌을 따라 천천히 올라가요. 숨이 차면 멈추기를 눌러요.": "Climbing the steps slowly. Tap Stop if you need a breather.",
  "잠깐 쉬어 가요. 다시 누르면 이어서 올라가요.": "Taking a break. Tap again to keep climbing.", "초를 밝혔어요": "Candle lit", "산의 기운이 가족을 지켜 주길 빌었어요.": "You prayed the mountain protects your family.",
  "별빛 아래 모두 건강하고 오래오래 행복하길 빌었어요.": "Under the stars, you prayed for health and long happiness.",
  // 실시간 · 행동 이름
  "방석에 앉았어요": "sat on a cushion", "일어났어요": "stood up", "목탁을 쳤어요": "struck the moktak", "합장했어요": "bowed with palms together", "절을 올렸어요": "bowed",
  "향을 피웠어요": "lit incense", "기도를 올렸어요": "prayed", "탑을 한 바퀴 돌았어요": "circled the pagoda", "공양을 해요": "is eating", "차를 마셔요": "is drinking tea",
  "범종을 울렸어요": "rang the bell", "달빛봉 정상에 올랐어요": "reached Moon Peak", "야호를 외쳤어요": "shouted yaho", "공양미를 올렸어요": "offered rice", "기와에 소원을 적었어요": "wrote a tile wish",
  "누군가": "Someone", "오솔길": "Footpath", "전각 사이 오솔길이에요. 지도를 열면 가고 싶은 곳으로 바로 갈 수 있어요.": "A footpath between the halls. Open the map to go anywhere instantly.", "휙~ 🍙": "Toss~ 🍙", "템플스테이": "Templestay", "🏯 달빛암 템플스테이": "🏯 Dalbitam Templestay", "오늘의 정진": "Today's practice", "마음 다지기": "Steady the mind", "정진": "Devotion", "🌙 밤 9시부터": "🌙 From 9 PM", "🌙 야간 정진": "🌙 Night practice",
  "절은 운동이 아니라 비우고, 바라고, 감사하는 시간이에요. 한 번 절할 때마다 마음 한 가지를 떠올려요.": "Bowing isn't exercise. It's a time to let go, wish and give thanks. With each bow, hold one thought in mind.",
  "나의 발원문 · 바라는 것, 감사한 것, 내려놓고 싶은 것": "My vow · what you wish for, are grateful for, or want to let go", "예: 가족 모두 건강하기를, 지난 일을 내려놓기를": "e.g. Health for my family, letting go of the past",
  "🙇 정진 시작하기": "🙇 Begin bowing", "수행 뱃지": "Badges", "수행 리포트": "Practice report", "성취등 방명록": "Lamp of achievement guestbook", "108배 완주": "108 bows", "1000배 정진": "1000 bows", "3000배 전설": "3000 bows legend",
  "누적 절": "Total bows", "누적 정진 시간": "Total time", "소모 열량 (추정)": "Calories (est.)", "지금 정진 달성률": "Current progress", "가장 큰 정진": "Longest session", "밝힌 성취등": "Lamps lit",
  "아직 밝힌 성취등이 없어요. 정진을 마치면 발원문과 함께 등이 켜져요.": "No lamps yet. Finish a session and a lamp lights with your vow.", "발원문 없이 정진": "Practice without a vow",
  "3000배는 밤 9시부터 시작할 수 있어요. 고요한 밤, 천천히 정진해요.": "3000 bows can start from 9 PM. Practice slowly in the quiet night.", "멈췄던 정진을 이어서 할 수 있어요. 목표를 바꾸면 새로 시작해요.": "You can continue where you stopped. Changing the goal starts over.",
  "🌙 3000배는 밤 9시부터 시작할 수 있어요": "🌙 3000 bows can start from 9 PM", "🧘 무릎을 지키는 바른 절 자세": "🧘 Proper bowing that protects your knees", "🙇 천천히 따라 해 보기": "🙇 Try it slowly",
  "⏸ 쉬기": "⏸ Rest", "▶ 이어서": "▶ Continue", "그만하기": "Stop", "🙏 회향하기": "🙏 Dedicate the merit", "성취등을 밝혔어요": "You lit the lamp", "🐉 3000배 · 디지털 성취등을 밝혔어요": "🐉 3000 bows · You lit the digital Lamp of Achievement",
  "비운 마음 자리에 작은 빛이 켜졌어요.": "A small light now shines where your mind was emptied.", "한 번 절할 때마다 마음 한 가지를 떠올려요.": "With each bow, hold one thought in mind.",
  "잠시 쉬어요. 물 한 모금 마시고 무릎을 풀어 주세요.": "Take a break. Sip some water and loosen your knees.", "정진의 공덕을 모든 이에게 회향합니다. 수고 많으셨어요.": "May the merit of this practice reach everyone. Well done.",
  "🙏 정진 인증 카드를 만들어 보세요": "🙏 Make a practice card to share", "손 먼저 짚고, 이마를 낮추며 내쉬고, 발가락 힘으로 일어나며 들이쉬어요.": "Hands down first, exhale as your forehead lowers, inhale as you rise on your toes.",
  "감사": "Gratitude", "지혜": "Wisdom", "건강": "Health", "용서": "Forgiveness", "자비": "Compassion", "비움": "Letting go", "인내": "Patience", "겸손": "Humility", "평안": "Peace", "참회": "Repentance", "사랑": "Love", "발원": "Vow",
  "오늘 숨 쉬고 있음에 감사합니다": "Grateful to be breathing today", "흔들릴 때 바르게 볼 수 있기를": "May I see clearly when I waver", "몸과 마음이 두루 편안하기를": "May body and mind be at ease", "나를 아프게 한 일을 내려놓습니다": "I let go of what hurt me",
  "모든 생명이 괴로움에서 벗어나기를": "May all beings be free from suffering", "욕심 하나를 내려놓습니다": "I set down one desire", "조급한 마음을 쉬게 합니다": "I let my hurried mind rest", "고개 숙여 배웁니다": "I bow my head and learn",
  "가족 모두 평안하기를": "May my family be at peace", "지난 잘못을 돌아봅니다": "I reflect on past mistakes", "곁에 있는 사람을 더 아끼기를": "May I cherish those beside me", "나의 바람이 모두에게 이롭기를": "May my wishes benefit all", "용왕기도": "Dragon King prayer", "연화바위 용왕기도": "Dragon King prayer at Lotus Rock", "용왕 정근": "Dragon King chant", "기도 멈추기": "Stop prayer",
  "금강굴": "Geumgang Cave", "금강굴 들어가기": "Enter Geumgang Cave", "금강굴 · 산신기도": "Geumgang Cave · Mountain Spirit prayer", "산신기도": "Mountain Spirit prayer", "금강굴 산신기도 · 산왕경": "Geumgang Cave · Mountain King Sutra", "⛰ 금강산": "⛰ Geumgang Peak",
  "바위산 기슭의 금강굴이에요. 굴 안에서 산신께 기도할 수 있어요.": "Geumgang Cave at the foot of the rocky peak. Pray to the Mountain Spirit inside.",
  "서늘한 바위굴 안이에요. 산신기도를 누르면 촛불과 향을 올리고 천천히 기도해요.": "Inside the cool stone cave. Tap the prayer to light candles and incense, then pray slowly.",
  "촛불을 밝혔어요. 향을 사르고 마음을 모아요.": "Candles lit. Burn the incense and gather your mind.", "향 연기 너머로, 무언가 어렴풋이 보여요…": "Beyond the incense smoke, something faintly appears…", "지도": "Map", "달빛암 지도": "Dalbitam map", "🗺️ 지도 보고 이동하기": "🗺️ Open map", "가고 싶은 곳을 누르면 바로 가요. 노란 점이 지금 내 자리예요.": "Tap a place to go there. The yellow dot is you.",
  "바다 연등": "Sea lantern", "🌊 바다 연등": "🌊 Sea lantern", "바다 연등을 달았어요. 파도 소리 들리는 바닷가 연등 줄에 걸렸어요.": "Your sea lantern now hangs on the beach line by the waves.",
  "소동자": "Little Novice", "대동자": "Senior Novice", "소행자": "Junior Postulant", "대행자": "Senior Postulant", "하급행자": "Practitioner I", "중급행자": "Practitioner II", "상급행자": "Practitioner III",
  "법사": "Dharma Teacher", "선사": "Zen Master", "대선사": "Great Zen Master", "고승": "Eminent Monk", "대고승": "Great Eminent Monk", "조사": "Patriarch", "진인": "True Sage",
  "목탁 · 절 · 기도 · 미션으로 공덕을 쌓을수록 게이지가 차오르고 다음 단계로 올라가요.": "As you build merit with the moktak, bows, prayer and missions, the gauge fills and you rise to the next rank.", "장경판전": "Janggyeong Panjeon", "장경판전 · 팔만대장경": "Tripitaka Koreana library", "월지": "Wolji Pond", "월지 · 달이 비치는 연못": "Wolji · pond of the moon",
  "경판 읽기": "Read a woodblock", "📜 한 장 더": "📜 One more", "연못 바라보기": "Gaze at the pond", "연꽃등 띄우기": "Float a lotus lamp",
  "팔만대장경을 모신 서고예요. 살창 사이로 바람이 드나들어요. 경판을 한 장 꺼내 읽어 보세요.": "The hall of the Tripitaka Koreana. Wind flows through the slatted windows. Take out a woodblock and read.",
  "정자가 물에 비치는 고요한 연못이에요. 가만히 바라보거나 연꽃등을 띄워 보세요.": "A still pond reflecting its pavilions. Gaze quietly or float a lotus lamp.",
  "연꽃등을 연못에 띄웠어요. 작은 불빛이 천천히 흘러가요.": "You floated a lotus lamp. Its little light drifts slowly.",
  "물에 비친 정자와 하늘을 가만히 바라보세요. 물결이 잦아들듯 마음도 잦아들어요.": "Watch the pavilions and sky in the water. As the ripples settle, so does your mind.",
  "장경판전에서 경판 한 장 읽기": "Read a woodblock at the library", "월지에 연꽃등 띄우기": "Float a lotus lamp on Wolji", "석굴암": "Seokguram Grotto", "석굴암 · 좌선하는 곳": "Seokguram · meditation", "석굴암 들어가기": "Enter Seokguram", "좌선하기": "Meditate", "좌선 멈추기": "Stop meditating",
  "들이쉬고": "Breathe in", "머물고": "Hold", "내쉬고": "Breathe out", "석굴암에서 좌선 한 번": "Meditate once in Seokguram", "🧘 좌선 인증 카드를 만들어 보세요": "🧘 Make a meditation card to share",
  "흙으로 덮인 둥근 석굴이에요. 들어가서 본존불 앞에 앉아 숨을 골라 보세요.": "A round stone grotto under an earthen mound. Go in and breathe before the Buddha.",
  "하얀 화강암 부처님이 고요히 바다 쪽을 바라보세요. 좌선하기를 누르고 숨을 따라 쉬어 보세요.": "The white granite Buddha gazes calmly toward the sea. Tap Meditate and follow your breath.",
  "허리를 펴고 어깨 힘을 빼요. 원 모양을 따라 천천히 숨을 쉬어 보세요.": "Sit tall, relax your shoulders, and breathe slowly with the circle.",
  "좌선을 잠시 멈췄어요. 언제든 다시 앉아요.": "Meditation paused. Sit again anytime.", "연등길": "Lantern Path", "달빛 바닷가": "Moonlit Beach", "바닷가": "Beach", "연화바위": "Lotus Rock", "해수관음": "Sea Guanyin", "연등길 · 바닷가 가는 길": "Lantern path · to the sea",
  "하얀 연등이 줄지어 걸린 길이에요. 따라 내려가면 바다가 나와요.": "A path lined with white lanterns. Follow it down to the sea.",
  "파도 소리가 들려요. 바위 앞 제단에서 기도하고, 물고기에게 먹이도 줘 보세요.": "You can hear the waves. Pray at the rock altar and feed the fish.",
  "바다를 마주한 큰 바위 앞이에요. 초를 켜고 절을 올리거나, 물고기 떼에게 먹이를 줘 보세요.": "Before the great rock facing the sea. Light a candle, bow, or feed the fish.",
  "바다 기도": "Sea prayer", "물고기 밥 주기": "Feed the fish", "방생하기": "Release a fish", "파도 소리": "Wave sounds", "파도 소리 끄기": "Stop waves", "관세음보살": "Gwanseeum Bosal",
  "먹이를 던지자 황어 떼가 우르르 몰려와요! 휴휴암 바다의 물고기들처럼요.": "The fish rush in as you toss the food, just like at Hyuhyuam by the sea!",
  "물고기 한 마리를 바다로 돌려보냈어요. 생명을 살리는 방생의 공덕이 쌓여요.": "You released a fish into the sea. Saving a life brings great merit.",
  "바다에 물고기가 가득해요. 모두 자유롭게 헤엄쳐요.": "The sea is full of fish, all swimming freely.", "🐟 잘 가렴": "🐟 Be free",
  "연화바위 앞 제단에 초와 향을 올렸어요. 파도 소리에 걱정을 실어 보내요.": "You lit candles at the Lotus Rock altar. Let the waves carry your worries away.",
  "파도 소리를 들으며 숨을 맞춰 보세요. 들숨에 밀려오고, 날숨에 쓸려 가요.": "Breathe with the waves: in as they come, out as they go.",
  "잠시 눈을 감고 파도 소리를 떠올려 보세요. 들숨에 밀려오고, 날숨에 쓸려 가요.": "Close your eyes and imagine the waves: in as they come, out as they go.",
  "계곡 물소리를 들으며 천천히 걸어 보세요.": "Walk slowly to the sound of the stream.", "바닷가 물고기에게 먹이 주기": "Feed the fish at the beach", "연등길 따라 바닷가 가기": "Walk the lantern path to the sea", "흔들바위": "Rocking Stone", "기와 불사 · 소원 기와": "Roof-tile wishes", "달빛봉 정상": "Moon Peak summit", "스님": "Monk", "불자": "friend",
  "📸 공유 카드 만들기": "📸 Make a share card", "🔗 주소 복사하기": "🔗 Copy link", "저장하기": "Save", "이미지를 길게 눌러 저장한 뒤 스토리에 올려 보세요": "Long-press the image to save it, then post it to your story",
  "🙇 108배 인증 카드를 만들어 자랑해 보세요": "🙇 Make a 108-bow card to share", "🙏 기도 인증 카드를 만들어 보세요": "🙏 Make a prayer card to share", "📸 공유": "📸 Share", "주소를 복사했어요": "Link copied",
  "촬영 모드 끝내기": "Exit recording mode", "온라인 산사 · 잠시 쉬어 가는 절": "Online temple", "🏮 새 연등": "🏮 New lantern",
  // 오늘의 한마디
  "마음이 고요하면 길이 보여요.": "When the mind is still, the path appears.", "비우면 비로소 채워집니다.": "Only when emptied are we filled.",
  "지금 이 순간에 머물러 보세요.": "Stay with this moment.", "천천히 들이쉬고, 길게 내쉬어 보세요.": "Breathe in slowly, breathe out long.",
  "오늘 하루도 충분히 애썼어요.": "You've done enough today.", "지나간 일은 바람처럼 흘려보내요.": "Let what's past drift by like the wind.",
  "작은 친절 하나가 큰 복이 됩니다.": "One small kindness becomes a great blessing.", "남과 비교하지 않는 하루가 편안한 하루예요.": "A day without comparison is a peaceful day.",
  "걱정은 내일의 몫으로 남겨 두어도 괜찮아요.": "It's fine to leave worries for tomorrow.", "내가 나에게 다정해지는 연습을 해요.": "Practice being gentle with yourself.",
  "화가 날 땐 세 번 숨을 쉬고 말해요.": "When angry, take three breaths before you speak.", "따뜻한 차 한 모금에 숨을 골라 보세요.": "Catch your breath with a sip of warm tea.",
  "공양은 먹을 만큼만, 감사한 마음으로 남김없이.": "Eat only what you need, gratefully, leaving nothing.",
  "안녕하세요 🙏": "Hello 🙏", "성불하세요": "May you find peace", "좋은 밤 되세요 🌙": "Good night 🌙", "같이 108배 해요": "Let's do 108 bows together", "고마워요": "Thank you", "힘내요": "You've got this",
};
const R = [
  [/^(\d+)배$/, (m) => `${m[1]} bows`],
  [/^똑 · (\d+)$/, (m) => `tok · ${m[1]}`],
  [/^월하당 (\d+)$/, (m) => `Moonlight Hall ${m[1]}`],
  [/^물고기들이 반갑게 몰려와요\. 지금까지 (\d+)번 먹이를 줬어요\.$/, (m) => `The fish swim over happily. You've fed them ${m[1]} times.`],
  [/^열 번의 숨, 한 번의 좌선을 마쳤어요\. 마음이 한결 고요해졌어요\. \(좌선 (\d+)회\)$/, (m) => `Ten breaths, one sitting. Your mind is calmer now. (sessions: ${m[1]})`],
  [/^ \(약 (.+)\)$/, (m) => ` (~${m[1].replace(/일/g, "d").replace(/시간/g, "h").replace(/분/g, "m")})`],
  [/^(\S+) · (\S+)$/, (m) => (D[m[1]] && D[m[2]] ? `${D[m[1]]} · ${D[m[2]]}` : null)],
  [/^지금 (\S+) · 다음 (\S+)$/, (m) => `Now ${t(m[1])} · next ${t(m[2])}`],
  [/^지금 (\S+) · 최고 등급$/, (m) => `Now ${t(m[1])} · top rank`],
  [/^용왕님께 (\d+)독을 올렸어요\. 큰 파도가 걱정을 싣고 가요\.$/, (m) => `${m[1]} round(s) offered to the Dragon King. A great wave carries your worries away.`],
  [/^산신께 (\d+)독을 올렸어요\. 호랑이가 조용히 곁을 지켜 줘요\.$/, (m) => `${m[1]} round(s) offered to the Mountain Spirit. The tiger quietly watches over you.`],
  [/^🙇 이어서 정진하기 \((\d+)\/(\d+)\)$/, (m) => `🙇 Continue (${m[1]}/${m[2]})`],
  [/^🛤 (\d+)배 · (.+)에 도착했어요$/, (m) => `🛤 ${m[1]} bows · arrived at ${m[2]}`],
  [/^(\d+)배 정진을 마치고 등을 밝혔어요$/, (m) => `${m[1]} bows done. You lit a lamp.`],
  [/^(.+) 뱃지를 얻었어요!$/, (m) => `${t(m[1].replace(/^\S+ /, ""))} badge earned!`],
  [/^정진을 멈췄어요\. 템플스테이에서 이어서 할 수 있어요 \((\d+)배\)\.$/, (m) => `Practice paused. Continue anytime from Templestay (${m[1]} bows).`],
  [/^발원: (.+)$/, (m) => `Vow: ${m[1]}`],
  [/^(\d+)배(\S*)$/, (m) => `${m[1]} bows`],
  [/^(.+)님이 들어왔어요$/, (m) => `${m[1]} joined`],
  [/^(.+)님이 나에게 합장했어요 🙏$/, (m) => `${m[1]} bowed to you 🙏`],
  [/^(.+)님이 합장했어요$/, (m) => `${m[1]} bowed`],
  [/^(.+)님께 합장$/, (m) => `Bow to ${m[1]}`],
  [/^✨ (.+)님이 108배를 마치고 (.+)을 밝혔어요$/, (m) => `✨ ${m[1]} finished 108 bows and lit a ${t(m[2])}`],
  [/^(.+)님이 (.+)$/, (m) => (D[m[2]] ? `${m[1]} ${D[m[2]]}` : null)],
  [/^(.+) 들어가기$/, (m) => `Enter ${t(m[1])}`],
  [/^(\d+)번째 독송 중 · (\d+)\/(\d+)$/, (m) => `Round ${m[1]} · ${m[2]}/${m[3]}`],
  [/^(\d+)독 마쳤어요$/, (m) => `${m[1]} round(s) chanted`],
  [/^(.+)에서 (\d+)독을 마쳤어요\. 마음이 맑아졌어요\.$/, (m) => `${m[2]} round(s) chanted in the ${t(m[1])}. Your mind feels clear.`],
  [/^북두칠성이 모두 밝혀졌어요\. (\d+)독, 별빛이 가족을 지켜 주길\.$/, (m) => `All seven stars are lit. Round ${m[1]}: may starlight protect your family.`],
  [/^(.+)님의 (.+)을 비옵니다$/, (m) => `${m[1]} prays for ${m[2]}`],
  [/^오늘의 수행 (\d)\/3$/, (m) => `Today's practice ${m[1]}/3`],
  [/^내 복전 🪙 (.+)$/, (m) => `My merit coins 🪙 ${m[1]}`],
  [/^공양 도감 (\d+) \/ (\d+)$/, (m) => `Meal collection ${m[1]} / ${m[2]}`],
  [/^복전이 (\d+)닢 모자라요.*$/, (m) => `You need ${m[1]} more coins. 108 bows earns 108 coins.`],
  [/^법명을 '(.+)'\(으\)로 바꿨어요$/, (m) => `Dharma name changed to '${m[1]}'`],
  [/^🛍️ (.+)을\(를\) 샀어요!$/, (m) => `🛍️ You bought: ${t(m[1])}!`],
  [/^🙇 지금 (\d+)명이 함께 절하고 있어요$/, (m) => `🙇 ${m[1]} people are bowing together now`],
  [/^(\S+) (.+)을 달았어요\. 대웅전에서 108배를 올리면 불이 켜져요 \(오늘 (\d+)\/108\)\.$/, (m) => `${m[1]} ${t(m[2])} hung. It lights up after 108 bows in the Main Hall (today ${m[3]}/108).`],
  [/^(.+)을 달았어요\. 오늘 108배를 이미 마쳐서 바로 불을 밝혀요!$/, (m) => `${t(m[1])} hung, and lit right away since you already did 108 bows today!`],
  [/^오늘 108배를 마치면 열려요 \((\d+)\/108\)$/, (m) => `Unlocks after today's 108 bows (${m[1]}/108)`],
  [/^🏮 내 .*에 불이 켜졌어요!$/, () => "🏮 Your lantern is lit!"],
  [/^108배의 공덕으로 .*에 불이 밝혀졌어요\.$/, () => "Your 108 bows have lit your lantern."],
  [/^✅ 오늘의 수행 완료: (.+) \(🪙30\)$/, (m) => `✅ Practice done: ${t(m[1])} (🪙30)`],
  [/^🎉 (.+)\(으\)로 올라갔어요!$/, (m) => `🎉 You're now a ${t(m[1])}!`],
  [/^(.+) 승급!$/, (m) => `${t(m[1])}!`],
  [/^📖 공양 도감에 (.+) 추가! \((\d+)\/(\d+)\)$/, (m) => `📖 ${t(m[1])} added to your collection! (${m[2]}/${m[3]})`],
  [/^(.+)을\(를\) 받으러 가요\.$/, (m) => `Going to get ${t(m[1])}.`],
  [/^📿 나만의 염꾸 '(.+)' 완성!.*$/, (m) => `📿 Your custom beads '${m[1]}' are ready! You'll use them in the bead counter too.`],
  [/^🪙 (\d+) · 만들기$/, (m) => `🪙 ${m[1]} · Make`],
  [/^🪙 (\d+) · 만들어서 착용하기$/, (m) => `🪙 ${m[1]} · Make & wear`],
  [/^(\d+)번째 알을 고르는 중이에요\..*$/, (m) => `Bead ${m[1]} selected. Pick a color for just this bead.`],
  [/^(\S+) 번째 바퀴$/, (m) => `Round ${({ 첫: 1, 두: 2, 세: 3, 네: 4, 다섯: 5 })[m[1]] || m[1]}`],
  [/^외 (\d+)명$/, (m) => `+${m[1]} more`],
  [/^(.+) \(나\)$/, (m) => `${m[1]} (me)`],
  [/^공양미를 올렸어요\. 지금까지 (\d+)되를 시주했어요\.$/, (m) => `Rice offered. You've given ${m[1]} measures so far.`],
  [/^🍚 공양미 한 되를 올렸어요 \(복전 -(\d+)\)$/, (m) => `🍚 One measure of rice offered (coins -${m[1]})`],
  [/^공양미 한 되는 복전 🪙(\d+)닢이에요.*$/, (m) => `A measure of rice costs 🪙${m[1]}. Bow and strike the moktak to earn coins.`],
  [/^⛰️ 달빛봉 정상에 올랐어요! \(🪙10\)$/, () => "⛰️ You reached Moon Peak! (🪙10)"],
  [/^딸깍 (\d+)번\..*$/, (m) => `${m[1]} clicks. Your mind feels lighter.`],
  [/^(.+) · 공덕 (.+) · (.+)까지 (.+)$/, (m) => `${t(m[1])} · merit ${m[2]} · ${m[4]} to ${t(m[3])}`],
  [/^(.+) · 공덕 (.+) · 최고 등급$/, (m) => `${t(m[1])} · merit ${m[2]} · top rank`],
  [/^(.+)은\(는\) (.+) 등급부터 쓸 수 있어요$/, (m) => `${t(m[1])} unlocks at ${t(m[2])}`],
  [/^(.+)부터 쓸 수 있어요$/, (m) => `Unlocks at ${t(m[1])}`],
  [/^(.+)은\(는\) 기념품 가게에서 🪙(\d+)에 살 수 있어요$/, (m) => `${t(m[1])} is 🪙${m[2]} in the gift shop`],
  [/^(.+) 정근$/, (m) => `${t(m[1])} chant`],
];
function t(s) {
  if (LANG !== "en" || !s) return s;
  const k = s.trim(); if (!/[가-힣]/.test(k)) return s;
  if (D[k]) return s.replace(k, D[k]);
  for (const [re, fn] of R) { const m = re.exec(k); if (m) { const r = fn(m); if (r) return s.replace(k, r); } }
  const pre = k.match(/^[^가-힣]*/)[0], post = k.match(/[^가-힣]*$/)[0], core = k.slice(pre.length, k.length - post.length);
  if (pre || post) { if (D[core]) return s.replace(k, pre + D[core] + post); }
  if (k.includes(" · ")) { const parts = k.split(" · "); if (parts.some((p) => D[p.trim()])) return s.replace(k, parts.map((p) => D[p.trim()] || p).join(" · ")); }
  return s;
}
window.T = t;
if (LANG === "en") {
  const tx = (node) => { const v = node.nodeValue; if (v && /[가-힣]/.test(v)) { const n = t(v); if (n !== v) node.nodeValue = n; } };
  const tel = (el) => { for (const a of ["placeholder", "aria-label", "title"]) { const v = el.getAttribute && el.getAttribute(a); if (v && /[가-힣]/.test(v)) { const n = t(v); if (n !== v) el.setAttribute(a, n); } } };
  const walk = (root) => { if (root.nodeType === 3) return tx(root); if (root.nodeType !== 1 || root.tagName === "SCRIPT" || root.tagName === "STYLE" || root.closest?.(".no-tr")) return; tel(root); const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT); let n; while ((n = w.nextNode())) { if (n.nodeType === 3) { if (!n.parentElement?.closest(".no-tr")) tx(n); } else tel(n); } };
  const start = () => { walk(document.body); new MutationObserver((ms) => { for (const m of ms) { if (m.type === "characterData") tx(m.target); else if (m.type === "attributes") tel(m.target); else m.addedNodes.forEach(walk); } }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["placeholder", "aria-label", "title"] }); };
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
  document.title = "Dalbitam · Korean Online Temple";
}
