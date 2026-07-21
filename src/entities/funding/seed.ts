// 하드코딩 초기 상태 (백엔드 대체). 여기 값은 손으로 채운 데모 시드 — now 기준으로 마감을 잡는다.
import type { Funding, Contribution } from "./model";
import type { AppState, Project, Meta } from "./store";

const DAY = 86_400_000;
const HOUR = 3_600_000;

const c = (funder: string, amount: number): Contribution => ({ funder, amount });

interface Seed {
  id: string; creator: string; target: number; rewardPool: number;
  offsetMs: number; status: Funding["status"]; contributions: Contribution[]; meta: Meta;
}

const SEEDS: Seed[] = [
  {
    id: "f1", creator: "하늘", target: 30_000, rewardPool: 1_500, offsetMs: 3 * DAY, status: "OPEN",
    contributions: [c("민서", 5_000), c("서준", 5_000), c("유나", 5_000), c("지호", 4_500), c("도윤", 3_000), c("하람", 3_000)],
    meta: {
      title: "손목 위 미니 화분 — 데스크 가드닝 키트", category: "취미",
      description: [
        "책상 한 켠에서 키우는 초소형 화분 키트예요. 물 주기 알림 스티커와 세 종류의 씨앗을 함께 담았어요.",
        "이번 펀딩으로 친환경 화분 몰드를 제작합니다. 달성하면 후원자분께 여분 씨앗 키트를 지분만큼 보상 포인트로 돌려드려요.",
      ],
    },
  },
  {
    id: "f2", creator: "도윤", target: 50_000, rewardPool: 2_000, offsetMs: 18 * DAY, status: "OPEN",
    contributions: [c("하늘", 5_000), c("서준", 2_600), c("지호", 1_000)],
    meta: {
      title: "심야 라디오 감성 LP 한정 제작", category: "음악",
      description: ["새벽에 어울리는 잔잔한 트랙 10곡을 담은 한정판 LP입니다. 아날로그 마스터링으로 따뜻한 소리를 살렸어요."],
    },
  },
  {
    id: "f3", creator: "민서", target: 20_000, rewardPool: 1_000, offsetMs: -1 * DAY, status: "SUCCESS",
    contributions: [c("하늘", 8_000), c("지호", 6_000), c("도윤", 4_000), c("서준", 2_000)],
    meta: {
      title: "제로웨이스트 대나무 칫솔 4종 세트", category: "리빙",
      description: [
        "플라스틱을 줄인 대나무 칫솔 4종 구성이에요. 생분해 포장과 여행용 케이스를 함께 준비했어요.",
        "목표를 달성해 정산이 끝난 프로젝트예요. 함께해주신 분들께 지분만큼 보상 포인트가 지급됐어요.",
      ],
    },
  },
  {
    id: "f4", creator: "지호", target: 40_000, rewardPool: 2_000, offsetMs: 9 * HOUR, status: "OPEN",
    contributions: [c("하늘", 5_000), c("도윤", 5_000), c("유나", 5_000), c("하람", 5_000), c("민서", 3_600), c("지우", 2_000)],
    meta: {
      title: "인디 퍼즐 게임 '별의 조각' 제작", category: "게임",
      description: [
        "밤하늘에 흩어진 별 조각을 잇는 감성 퍼즐 게임입니다. 한 손으로 즐기는 60개 스테이지와 오리지널 배경음악을 담았어요.",
        "이번 펀딩으로 남은 20개 스테이지의 일러스트와 사운드를 완성합니다. 작은 팀이 오래 준비한 프로젝트라, 여러분의 포인트가 마지막 한 걸음이 됩니다.",
        "목표를 달성하면 후원자분께는 얼리액세스 빌드와 디지털 아트북을 지분에 따라 보상 포인트로 돌려드려요.",
      ],
    },
  },
  {
    id: "f5", creator: "도윤", target: 35_000, rewardPool: 1_500, offsetMs: -2 * DAY, status: "FAILED",
    contributions: [c("서준", 5_000), c("하늘", 3_000), c("유나", 3_300), c("지호", 2_000)],
    meta: {
      title: "수제 베지터블 가죽 카드지갑", category: "패션",
      description: [
        "한 장씩 손으로 재단한 식물성 가죽 카드지갑이에요. 쓸수록 손에 맞게 길드는 소재를 골랐어요.",
        "아쉽게 기한 내 목표에 닿지 못해 종료된 프로젝트예요. 참여 포인트는 규칙에 따라 소각됐어요.",
      ],
    },
  },
  {
    id: "f6", creator: "하늘", target: 45_000, rewardPool: 2_000, offsetMs: 6 * DAY, status: "OPEN",
    contributions: [c("하람", 5_000), c("지호", 3_000), c("유나", 2_150), c("민서", 2_000)],
    meta: {
      title: "로컬 로스터리 싱글오리진 원두 구독", category: "푸드",
      description: ["동네 로스터리가 매달 볶는 싱글오리진 원두를 집으로 보내드려요. 산지와 로스팅 노트를 카드로 함께 담아요."],
    },
  },
];

const raisedOf = (cs: Contribution[]): number => cs.reduce((a, x) => a + x.amount, 0);

// 데모 계정 잔액(현재 시점 하드코딩). 시드 기여는 '과거'라 잔액과 엄밀히 보존되진 않는다(데모 목적).
const BALANCES: Record<string, number> = { 민서: 12_500, 지호: 8_300, 하늘: 21_000, 도윤: 4_200 };

// 전환 가능한 데모 계정(후원자 서준/유나/하람/지우는 목록엔 안 나오고 기여로만 등장).
export const DEMO_ACCOUNTS = ["민서", "지호", "하늘", "도윤"];

export function seedState(now: number): AppState {
  const projects: Project[] = SEEDS.map((s) => {
    const funding: Funding = {
      id: s.id, creator: s.creator, target: s.target, rewardPool: s.rewardPool,
      deadline: now + s.offsetMs, status: s.status, raised: raisedOf(s.contributions),
      contributions: s.contributions,
    };
    return { funding, meta: s.meta };
  });
  return { balances: { ...BALANCES }, users: [...DEMO_ACCOUNTS], projects, currentUser: "민서" };
}
