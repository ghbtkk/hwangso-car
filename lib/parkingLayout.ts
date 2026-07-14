// 주차 구역의 기준(zone/row/col 배치)을 정의합니다.
// 이 배치가 앱 전체(대시보드 위치 지정/이동, 주차 현황판)의 유일한 기준입니다.

export type ParkingLocation = {
  location_id: number;
  section: string;
  row: string;
  spot: string;
};

export const PARKING_ZONES = [
  "3층",
  "5층",
  "8층",
  "9층",
  "외부 A",
  "외부 B",
  "월드 주차장",
];

export function getTableLayout(zone: string) {
  if (zone === "월드 주차장") {
    return {
      rows: [
        { rowLabel: "기본구역 1열", matchKey: "기본-1" },
        { rowLabel: "기본구역 2열", matchKey: "기본-2" },
        { rowLabel: "A구역 1열", matchKey: "A-1" },
        { rowLabel: "A구역 2열", matchKey: "A-2" },
        { rowLabel: "B구역 1열", matchKey: "B-1" },
      ],
      cols: [1, 2, 3, 4, 5, 6],
    };
  }

  return {
    rows: [
      { rowLabel: "20번 라인", matchKey: "20-" },
      { rowLabel: "18번 라인", matchKey: "18-" },
      { rowLabel: "12번 라인", matchKey: "12-" },
      { rowLabel: "10번 라인", matchKey: "10-" },
    ],
    cols: [1, 2, 3, 4],
  };
}

// 사람이 읽기 좋은 위치 문구로 변환합니다. (예: "3층 20번 라인 (1번)")
// 기준 배치(PARKING_ZONES/getTableLayout)에 없는 예전 데이터는 원본 값으로 표시합니다.
export function formatLocationText(loc: ParkingLocation | null | undefined) {
  if (!loc) return "위치 지정 없음";

  const layout = getTableLayout(loc.section);
  const row = layout.rows.find((r) => r.matchKey === loc.row);

  if (row) {
    return `${loc.section} ${row.rowLabel} (${loc.spot}번)`;
  }
  return `${loc.section} ${loc.row}열 (${loc.spot}번)`;
}

// 특정 칸(zone/matchKey/colNum)에 해당하는 parkinglocation row를 찾고,
// 없으면 새로 만들어서 location_id를 돌려줍니다.
export async function resolveLocationId(
  supabaseClient: any,
  locations: ParkingLocation[],
  zone: string,
  matchKey: string,
  colNum: number,
): Promise<{ locationId: number; newLocation?: ParkingLocation } | { error: string }> {
  const spotVal = String(colNum);
  const existing = locations.find(
    (l) => l.section === zone && l.row === matchKey && l.spot === spotVal,
  );
  if (existing) return { locationId: existing.location_id };

  const { data, error } = await supabaseClient
    .from("parkinglocation")
    .insert([{ section: zone, row: matchKey, spot: spotVal }])
    .select()
    .single();

  if (error || !data) {
    return { error: error?.message || "알 수 없는 오류" };
  }

  return { locationId: data.location_id, newLocation: data as ParkingLocation };
}
