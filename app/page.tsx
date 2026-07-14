import React from "react";
import { supabase } from "@/lib/supabase";
import { formatLocationText } from "@/lib/parkingLayout";
import Dashboard from "../components/Dashboard";

export const revalidate = 0;

export default async function Home() {
  // DB 서버사이드 로딩
  const { data: rawCars } = await supabase.from("car").select("*");
  const { data: locations } = await supabase
    .from("parkinglocation")
    .select("*");
  const { data: rawHistories } = await supabase
    .from("locationhistory")
    .select("*")
    .order("changed_at", { ascending: false })
    .limit(5);
  const { data: users } = await supabase.from("user").select("*");

  // 데이터 초기 정제 및 매핑
  const initialCars =
    rawCars?.map((car) => {
      const loc = locations?.find(
        (l) => l.location_id === car.parking_location_id,
      );
      return {
        ...car,
        locationText: formatLocationText(loc),
      };
    }) || [];

  const initialHistories =
    rawHistories?.map((history) => {
      const car = rawCars?.find((c) => c.car_id === history.car_id);
      const user = users?.find((u) => u.user_id === history.user_id);
      const beforeLoc = locations?.find(
        (l) => l.location_id === history.before_location_id,
      );
      const afterLoc = locations?.find(
        (l) => l.location_id === history.after_location_id,
      );

      return {
        id: history.history_id,
        carNumber: car ? car.car_number : "알 수 없는 차량",
        worker: user ? user.name : "알 수 없음",
        action: `${beforeLoc ? beforeLoc.section + "-" + beforeLoc.spot : "최초입차"} ➔ ${afterLoc ? afterLoc.section + "-" + afterLoc.spot : "출차"}`,
        time: new Date(history.changed_at).toLocaleTimeString("ko-KR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
    }) || [];

  return (
    <Dashboard
      initialCars={initialCars}
      locations={locations || []}
      initialHistories={initialHistories}
      users={users || []}
    />
  );
}
