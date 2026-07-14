"use client";

import React, { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import {
  PARKING_ZONES,
  getTableLayout,
  formatLocationText,
  resolveLocationId,
  type ParkingLocation,
} from "@/lib/parkingLayout";

export default function Dashboard({
  initialCars,
  locations: initialLocations,
  initialHistories,
  users,
}: any) {
  const router = useRouter();

  // 주차 구역/위치 데이터 (드래그 없이도 새 자리가 생기면 즉시 반영)
  const [locations, setLocations] = useState<ParkingLocation[]>(
    initialLocations || [],
  );

  // 메모 확인 및 수정을 위한 상태
  const [isViewMemoModalOpen, setIsViewMemoModalOpen] = useState(false);
  const [selectedCarForMemo, setSelectedCarForMemo] = useState<any>(null);
  const [memoInput, setMemoInput] = useState("");

  // 실시간 상태 관리
  const [cars, setCars] = useState(initialCars);
  const [histories, setHistories] = useState(initialHistories);

  // 검색 상태
  const [searchTerm, setSearchTerm] = useState("");

  // 모달(팝업창) 제어 상태
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [selectedCar, setSelectedCar] = useState<any>(null);

  // 등록 폼 상태
  const [newCar, setNewCar] = useState({
    car_number: "",
    brand: "",
    model: "",
    color: "",
  });
  // 등록 폼의 주차 위치 (구역/라인/자리) - 주차 현황판과 동일한 기준을 사용합니다.
  const [newCarZone, setNewCarZone] = useState("");
  const [newCarRow, setNewCarRow] = useState("");
  const [newCarCol, setNewCarCol] = useState("");

  // 이동 폼의 주차 위치 (구역/라인/자리)
  const [targetZone, setTargetZone] = useState("");
  const [targetRow, setTargetRow] = useState("");
  const [targetCol, setTargetCol] = useState("");

  // 데이터 수강(리프레시) 함수
  const refreshData = async () => {
    const { data: c } = await supabase.from("car").select("*");
    const { data: l } = await supabase.from("parkinglocation").select("*");
    const { data: h } = await supabase
      .from("locationhistory")
      .select("*")
      .order("changed_at", { ascending: false })
      .limit(5);

    setLocations(l || []);

    const updatedCars =
      c?.map((car) => {
        const loc = l?.find(
          (item) => item.location_id === car.parking_location_id,
        );
        return {
          ...car,
          locationText: formatLocationText(loc),
        };
      }) || [];

    const updatedHistories =
      h?.map((history) => {
        const car = c?.find((carItem) => carItem.car_id === history.car_id);
        const user = users?.find((u: any) => u.user_id === history.user_id);
        const beforeLoc = l?.find(
          (item) => item.location_id === history.before_location_id,
        );
        const afterLoc = l?.find(
          (item) => item.location_id === history.after_location_id,
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

    setCars(updatedCars);
    setHistories(updatedHistories);
    router.refresh();
  };

  const filteredCars = cars.filter((car: any) => {
    const cleanTerm = searchTerm.replace(/\s+/g, "");
    const cleanCarNum = car.car_number.replace(/\s+/g, "");
    const last4Digits = cleanCarNum.slice(-4);

    return cleanCarNum.includes(cleanTerm) || last4Digits.includes(cleanTerm);
  });

  const handleAddCar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCar.car_number) return alert("차량 번호는 필수입니다.");

    let parkingLocationId: number | null = null;
    if (newCarZone && newCarRow && newCarCol) {
      const result = await resolveLocationId(
        supabase,
        locations,
        newCarZone,
        newCarRow,
        Number(newCarCol),
      );
      if ("error" in result) return alert("자리 정보 생성 실패: " + result.error);
      if (result.newLocation) {
        setLocations((prev) => [...prev, result.newLocation!]);
      }
      parkingLocationId = result.locationId;
    }

    const { error } = await supabase.from("car").insert([
      {
        car_number: newCar.car_number,
        brand: newCar.brand,
        model: newCar.model,
        color: newCar.color,
        status: "주차중",
        parking_location_id: parkingLocationId,
      },
    ]);

    if (error) {
      alert("등록 실패: " + error.message);
    } else {
      alert("새로운 차량이 등록되었습니다.");
      setIsAddModalOpen(false);
      setNewCar({
        car_number: "",
        brand: "",
        model: "",
        color: "",
      });
      setNewCarZone("");
      setNewCarRow("");
      setNewCarCol("");
      await refreshData();
    }
  };

  const handleMoveCar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCar || !targetZone || !targetRow || !targetCol) return;

    const result = await resolveLocationId(
      supabase,
      locations,
      targetZone,
      targetRow,
      Number(targetCol),
    );
    if ("error" in result) return alert("자리 정보 생성 실패: " + result.error);
    if (result.newLocation) {
      setLocations((prev) => [...prev, result.newLocation!]);
    }

    const beforeLocationId = selectedCar.parking_location_id;
    const afterLocationId = result.locationId;

    if (beforeLocationId === afterLocationId) {
      alert("이미 같은 위치에 있습니다.");
      return;
    }

    const { error: carUpdateError } = await supabase
      .from("car")
      .update({ parking_location_id: afterLocationId })
      .eq("car_id", selectedCar.car_id);

    if (carUpdateError)
      return alert("위치 수정 실패: " + carUpdateError.message);

    await supabase.from("locationhistory").insert([
      {
        car_id: selectedCar.car_id,
        user_id: 1,
        before_location_id: beforeLocationId,
        after_location_id: afterLocationId,
      },
    ]);

    alert("차량 위치가 변경되었습니다.");
    setIsMoveModalOpen(false);
    setTargetZone("");
    setTargetRow("");
    setTargetCol("");
    await refreshData();
  };

  const handleDeleteCar = async (carId: number, carNumber: string) => {
    if (!confirm(`[${carNumber}] 차량을 판매 완료 처리(삭제)하시겠습니까?`))
      return;

    const { error } = await supabase.from("car").delete().eq("car_id", carId);

    if (error) {
      alert("삭제 실패: " + error.message);
    } else {
      alert("판매 완료 처리되어 목록에서 삭제되었습니다.");
      await refreshData();
    }
  };

  const handleUpdateMemo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCarForMemo) return;
    if (!memoInput.trim()) return alert("메모 내용을 입력해주세요.");

    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    const newMemoLine = `[${formattedDate}] ${memoInput}`;
    const updatedMemo = selectedCarForMemo.memo
      ? `${selectedCarForMemo.memo}\n${newMemoLine}`
      : newMemoLine;

    const { error } = await supabase
      .from("car")
      .update({ memo: updatedMemo })
      .eq("car_id", selectedCarForMemo.car_id);

    if (error) {
      alert("메모 저장 실패: " + error.message);
    } else {
      alert("메모가 수정(추가)되었습니다.");
      setMemoInput("");
      setIsViewMemoModalOpen(false);
      setSelectedCarForMemo(null);
      await refreshData();
    }
  };

  const totalCars = cars.length;
  const parkingCars = cars.filter((c: any) => c.status === "주차중").length;

  return (
    <div>
      {/* 상단 타이틀 영역 */}
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">
            중고차 주차 관리 시스템 🚗
          </h1>
          <p className="mt-2 text-sm sm:text-base text-gray-500">
            차량 검색, 등록, 위치 변경, 판매 처리가 가능합니다.
          </p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="w-full sm:w-auto rounded-xl bg-blue-600 px-5 py-3.5 text-base font-bold text-white hover:bg-blue-700 transition shadow-md active:scale-[0.99]"
        >
          ➕ 새 차량 등록
        </button>
      </header>
      {/* 현황 통계 영역 */}
      <section className="mb-6 grid grid-cols-3 gap-3 sm:gap-5">
        <div className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100 text-center sm:text-left">
          <p className="text-xs sm:text-sm font-bold text-gray-400 uppercase tracking-wider">
            전체 보유
          </p>
          <p className="mt-1 text-xl sm:text-3xl font-extrabold text-gray-900">
            {totalCars}
            <span className="text-sm sm:text-lg font-normal ml-0.5">대</span>
          </p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100 text-center sm:text-left">
          <p className="text-xs sm:text-sm font-bold text-gray-400 uppercase tracking-wider">
            현재 주차
          </p>
          <p className="mt-1 text-xl sm:text-3xl font-extrabold text-green-600">
            {parkingCars}
            <span className="text-sm sm:text-lg font-normal ml-0.5">대</span>
          </p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm border border-gray-100 text-center sm:text-left">
          <p className="text-xs sm:text-sm font-bold text-gray-400 uppercase tracking-wider">
            검색 결과
          </p>
          <p className="mt-1 text-xl sm:text-3xl font-extrabold text-blue-600">
            {filteredCars.length}
            <span className="text-sm sm:text-lg font-normal ml-0.5">대</span>
          </p>
        </div>
      </section>
      {/* 검색 바 */}
      <div className="mb-5">
        <input
          type="text"
          placeholder="차량 번호 입력 (예: 3456 또는 전체)"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full lg:w-1/3 rounded-xl border-2 border-gray-300 px-4 py-3.5 text-base focus:border-blue-500 focus:outline-none shadow-sm text-black placeholder-gray-400"
        />
      </div>
      <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link
          href="/car-list"
          className="group flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:shadow-md sm:p-5"
        >
          <div>
            <p className="text-sm font-bold text-gray-900 sm:text-base">
              📋 지정번호 관리 대장
            </p>
            <p className="mt-0.5 text-xs text-gray-500 sm:text-sm">
              1~300번 고정 자리의 등록/공석 현황을 확인합니다.
            </p>
          </div>
          <span className="text-blue-600 transition group-hover:translate-x-0.5">
            →
          </span>
        </Link>

        <Link
          href="/parking-board"
          className="group flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-amber-200 hover:shadow-md sm:p-5"
        >
          <div>
            <p className="text-sm font-bold text-gray-900 sm:text-base">
              🗂️ 실물 자석판 주차 현황판
            </p>
            <p className="mt-0.5 text-xs text-gray-500 sm:text-sm">
              구역별 바둑판 배치로 실제 주차 위치를 확인합니다.
            </p>
          </div>
          <span className="text-amber-600 transition group-hover:translate-x-0.5">
            →
          </span>
        </Link>
      </section>
      {/* 메인 콘텐츠 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 차량 목록 */}
        <section className="lg:col-span-2 rounded-2xl bg-white p-4 sm:p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">
            보유 차량 목록
          </h2>

          {/* 🖥️ 데스크톱 화면 테이블 형태 */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left text-sm sm:text-base text-gray-500">
              <thead className="bg-gray-50 text-xs sm:text-sm uppercase text-gray-700 font-bold border-b">
                <tr>
                  <th className="px-4 py-3.5">차량번호</th>
                  <th className="px-4 py-3.5">모델 (브랜드)</th>
                  <th className="px-4 py-3.5">현재 위치</th>
                  <th className="px-4 py-3.5 text-center">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-gray-900">
                {filteredCars.map((car: any) => (
                  <tr
                    key={car.car_id}
                    className="hover:bg-gray-50/80 transition-colors"
                  >
                    <td className="px-4 py-4 font-bold">
                      <button
                        onClick={() => {
                          setSelectedCarForMemo(car);
                          setIsViewMemoModalOpen(true);
                        }}
                        className="text-blue-600 hover:text-blue-800 hover:underline text-left focus:outline-none text-base"
                      >
                        {car.car_number}
                      </button>
                    </td>
                    <td className="px-4 py-4">
                      {car.model}{" "}
                      <span className="text-sm text-gray-500">
                        ({car.brand})
                      </span>
                    </td>
                    <td className="px-4 py-4 text-blue-600 font-bold">
                      {car.locationText}
                    </td>
                    <td className="px-4 py-4 flex justify-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedCar(car);
                          setTargetZone("");
                          setTargetRow("");
                          setTargetCol("");
                          setIsMoveModalOpen(true);
                        }}
                        className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-200"
                      >
                        📍 위치 이동
                      </button>
                      <button
                        onClick={() =>
                          handleDeleteCar(car.car_id, car.car_number)
                        }
                        className="rounded-lg bg-red-50 px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-100"
                      >
                        💰 판매 완료
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 📱 모바일 화면 카드 리스트 형태 */}
          <div className="block sm:hidden space-y-4">
            {filteredCars.map((car: any) => (
              <div
                key={car.car_id}
                className="p-5 rounded-2xl border-2 border-gray-200 bg-white shadow-sm flex flex-col gap-3"
              >
                <div className="flex justify-between items-center">
                  <button
                    onClick={() => {
                      setSelectedCarForMemo(car);
                      setIsViewMemoModalOpen(true);
                    }}
                    className="text-xl font-black text-blue-600 hover:underline text-left tracking-wide"
                  >
                    {car.car_number}{" "}
                    <span className="text-sm font-normal text-gray-400 ml-1">
                      📝 메모
                    </span>
                  </button>
                </div>

                <div className="flex flex-col gap-1.5 bg-gray-50 p-3 rounded-xl border border-gray-100 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400 font-medium">현재 위치</span>
                    <span className="text-blue-600 font-bold text-base">
                      {car.locationText}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400 font-medium">모델 정보</span>
                    <span className="text-gray-900 font-semibold">
                      {car.model} ({car.brand || "미지정"})
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-1">
                  <button
                    onClick={() => {
                      setSelectedCar(car);
                      setIsMoveModalOpen(true);
                    }}
                    className="rounded-xl bg-gray-100 py-3 text-center text-sm font-bold text-gray-700 hover:bg-gray-200 active:bg-gray-300"
                  >
                    📍 위치 이동
                  </button>
                  <button
                    onClick={() => handleDeleteCar(car.car_id, car.car_number)}
                    className="rounded-xl bg-red-50 py-3 text-center text-sm font-bold text-red-600 hover:bg-red-100 active:bg-red-200"
                  >
                    💰 판매 완료
                  </button>
                </div>
              </div>
            ))}
          </div>

          {filteredCars.length === 0 && (
            <div className="py-16 text-center text-base font-medium text-gray-400">
              일치하는 차량이 없습니다.
            </div>
          )}

          {/* 🌟 [수정] 모바일/데스크톱 모두 화면 정중앙 배치 처리 (items-center) */}
          {isViewMemoModalOpen && selectedCarForMemo && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
              <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl text-black">
                <div className="flex justify-between items-start border-b pb-4 mb-4">
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900">
                      📝 차량 비고/메모 관리
                    </h3>
                    <p className="text-sm font-semibold text-blue-600 mt-1">
                      {selectedCarForMemo.locationText}
                    </p>
                  </div>
                  <span className="text-base font-bold bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg">
                    {selectedCarForMemo.car_number}
                  </span>
                </div>

                <label className="block text-sm font-bold text-gray-500 mb-1.5">
                  기존 메모 기록
                </label>
                <div className="bg-gray-50 rounded-xl p-3.5 max-h-44 overflow-y-auto border border-gray-200 mb-4 text-sm sm:text-base">
                  {selectedCarForMemo.memo ? (
                    <p className="text-gray-800 whitespace-pre-line leading-relaxed">
                      {selectedCarForMemo.memo}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-400 text-center py-6">
                      등록된 메모 기록이 없습니다.
                    </p>
                  )}
                </div>

                <form onSubmit={handleUpdateMemo}>
                  <div className="mb-5">
                    <label className="block text-sm font-bold text-gray-500 mb-1.5">
                      새로운 메모 추가
                    </label>
                    <textarea
                      rows={3}
                      placeholder="내용을 입력하세요..."
                      value={memoInput}
                      onChange={(e) => setMemoInput(e.target.value)}
                      className="w-full border-2 rounded-xl p-3 text-base focus:border-blue-500 focus:outline-none bg-white resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-3 border-t">
                    <button
                      type="button"
                      onClick={() => {
                        setIsViewMemoModalOpen(false);
                        setSelectedCarForMemo(null);
                        setMemoInput("");
                      }}
                      className="py-3 bg-gray-100 hover:bg-gray-200 font-bold rounded-xl text-base transition-colors text-center"
                    >
                      닫기
                    </button>
                    <button
                      type="submit"
                      className="py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-base transition-colors text-center"
                    >
                      메모 저장
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </section>

        {/* 최근 이동 이력 */}
        <section className="rounded-2xl bg-white p-4 sm:p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">
            최근 이동 이력
          </h2>
          <div className="flow-root">
            {histories.length > 0 ? (
              <ul className="-mb-8 text-sm sm:text-base">
                {histories.map((history: any, historyIdx: number) => (
                  <li key={history.id}>
                    <div className="relative pb-8">
                      {historyIdx !== histories.length - 1 ? (
                        <span
                          className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200"
                          aria-hidden="true"
                        />
                      ) : null}
                      <div className="relative flex space-x-3">
                        <div>
                          <span className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center text-sm">
                            📍
                          </span>
                        </div>
                        <div className="flex-1 min-w-0 pt-1">
                          <p className="font-bold text-gray-900">
                            {history.carNumber}{" "}
                            <span className="font-normal text-sm text-gray-500">
                              ({history.worker})
                            </span>
                          </p>
                          <p className="text-sm font-medium text-gray-600 mt-1">
                            {history.action}
                          </p>
                          <span className="text-xs text-gray-400 block mt-1">
                            {history.time}
                          </span>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-base text-gray-400 text-center py-8">
                최근 이동 기록이 없습니다.
              </p>
            )}
          </div>
        </section>
      </div>
      {/* 🌟 [수정] 새 차량 등록 모달 - 정중앙 배치 */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl text-black">
            <h3 className="text-lg sm:text-xl font-bold mb-4">
              새 차량 등록하기
            </h3>
            <form onSubmit={handleAddCar} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  차량 번호
                </label>
                <input
                  type="text"
                  required
                  placeholder="예: 12가 3456"
                  value={newCar.car_number}
                  onChange={(e) =>
                    setNewCar({ ...newCar, car_number: e.target.value })
                  }
                  className="w-full border-2 p-3 rounded-xl text-base"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    브랜드
                  </label>
                  <input
                    type="text"
                    placeholder="예: 현대"
                    value={newCar.brand}
                    onChange={(e) =>
                      setNewCar({ ...newCar, brand: e.target.value })
                    }
                    className="w-full border-2 p-3 rounded-xl text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    모델
                  </label>
                  <input
                    type="text"
                    placeholder="예: 아반떼"
                    value={newCar.model}
                    onChange={(e) =>
                      setNewCar({ ...newCar, model: e.target.value })
                    }
                    className="w-full border-2 p-3 rounded-xl text-base"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  색상
                </label>
                <input
                  type="text"
                  placeholder="예: 흰색"
                  value={newCar.color}
                  onChange={(e) =>
                    setNewCar({ ...newCar, color: e.target.value })
                  }
                  className="w-full border-2 p-3 rounded-xl text-base"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  초기 주차 위치
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={newCarZone}
                    onChange={(e) => {
                      setNewCarZone(e.target.value);
                      setNewCarRow("");
                      setNewCarCol("");
                    }}
                    className="w-full border-2 p-3 rounded-xl bg-white text-base"
                  >
                    <option value="">구역</option>
                    {PARKING_ZONES.map((zone) => (
                      <option key={zone} value={zone}>
                        {zone}
                      </option>
                    ))}
                  </select>
                  <select
                    value={newCarRow}
                    onChange={(e) => setNewCarRow(e.target.value)}
                    disabled={!newCarZone}
                    className="w-full border-2 p-3 rounded-xl bg-white text-base disabled:bg-gray-100 disabled:text-gray-400"
                  >
                    <option value="">라인</option>
                    {newCarZone &&
                      getTableLayout(newCarZone).rows.map((row) => (
                        <option key={row.matchKey} value={row.matchKey}>
                          {row.rowLabel}
                        </option>
                      ))}
                  </select>
                  <select
                    value={newCarCol}
                    onChange={(e) => setNewCarCol(e.target.value)}
                    disabled={!newCarZone}
                    className="w-full border-2 p-3 rounded-xl bg-white text-base disabled:bg-gray-100 disabled:text-gray-400"
                  >
                    <option value="">자리</option>
                    {newCarZone &&
                      getTableLayout(newCarZone).cols.map((col) => (
                        <option key={col} value={col}>
                          {col}번
                        </option>
                      ))}
                  </select>
                </div>
                <p className="mt-1.5 text-xs text-gray-400">
                  구역·라인·자리를 모두 선택해야 위치가 지정됩니다. 선택하지
                  않으면 미지정 상태로 등록됩니다.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="py-3 bg-gray-100 rounded-xl text-base font-bold"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="py-3 bg-blue-600 text-white rounded-xl text-base font-bold"
                >
                  등록
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* 🌟 [수정] 차량 위치 이동 모달 - 정중앙 배치 */}
      {isMoveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl text-black">
            <h3 className="text-lg sm:text-xl font-bold mb-1">
              🚗 차량 위치 이동
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              선택 차량:{" "}
              <span className="font-bold text-gray-900 text-base">
                {selectedCar?.car_number}
              </span>
              {selectedCar?.locationText && (
                <span className="block text-xs text-gray-400 mt-0.5">
                  현재 위치: {selectedCar.locationText}
                </span>
              )}
            </p>
            <form onSubmit={handleMoveCar} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  이동할 주차 공간 선택
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <select
                    required
                    value={targetZone}
                    onChange={(e) => {
                      setTargetZone(e.target.value);
                      setTargetRow("");
                      setTargetCol("");
                    }}
                    className="w-full border-2 p-3 rounded-xl bg-white text-base"
                  >
                    <option value="">구역</option>
                    {PARKING_ZONES.map((zone) => (
                      <option key={zone} value={zone}>
                        {zone}
                      </option>
                    ))}
                  </select>
                  <select
                    required
                    value={targetRow}
                    onChange={(e) => setTargetRow(e.target.value)}
                    disabled={!targetZone}
                    className="w-full border-2 p-3 rounded-xl bg-white text-base disabled:bg-gray-100 disabled:text-gray-400"
                  >
                    <option value="">라인</option>
                    {targetZone &&
                      getTableLayout(targetZone).rows.map((row) => (
                        <option key={row.matchKey} value={row.matchKey}>
                          {row.rowLabel}
                        </option>
                      ))}
                  </select>
                  <select
                    required
                    value={targetCol}
                    onChange={(e) => setTargetCol(e.target.value)}
                    disabled={!targetZone}
                    className="w-full border-2 p-3 rounded-xl bg-white text-base disabled:bg-gray-100 disabled:text-gray-400"
                  >
                    <option value="">자리</option>
                    {targetZone &&
                      getTableLayout(targetZone).cols.map((col) => (
                        <option key={col} value={col}>
                          {col}번
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsMoveModalOpen(false)}
                  className="py-3 bg-gray-100 rounded-xl text-base font-bold"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="py-3 bg-green-600 text-white rounded-xl text-base font-bold"
                >
                  위치 변경 확정
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
