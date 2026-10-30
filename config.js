// ① Supabase 프로젝트를 만든 뒤, Project Settings → API 화면에 있는 두 값을 붙여 넣으세요.
//    비워 두면 '혼자 수행 모드'로 열려요 (다른 사람은 안 보이고, 연등은 내 기기에만 저장돼요).
export const CONFIG = {
  supabaseUrl: "https://mueithrcebrhdfmhuzev.supabase.co",
  supabaseAnonKey: "sb_publishable_qcYBpQiM1l0gPAa2KjxEYQ_JKqVDWPX",   // publishable(공개용) 키. 공개돼도 되는 키예요

  siteName: "달빛암",
  roomName: "월하당",     // 법당 이름. "월하당 1", "월하당 2"처럼 나뉘어요
  roomCount: 20,          // 법당 개수
  roomCap: 20             // 법당 한 곳 최대 인원. 차면 다음 법당으로 자동 이동 (무료 플랜은 20 권장)
};
