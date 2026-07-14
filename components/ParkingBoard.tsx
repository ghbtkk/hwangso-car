"use client";

import React, { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import {
  PARKING_ZONES,
  getTableLayout,
  formatLocationText,
  resolveLocationId as resolveLocationIdShared,
  type ParkingLocation,
} from "@/lib/parkingLayout";

type Car = {
  car_id: number;
  car_number: string;
  brand: string | null;
  model: string | null;
  memo: string | null;
  parking_location_id: number | null;
  [key: string]: any;
};

export default function ParkingBoard({
  initialCars,
  initialLocations,
}: {
  initialCars: Car[];
  initialLocations: ParkingLocation[];
}) {
  const router = useRouter();

  // 현재 선택된 주차장 토글 상태
  const [selectedZone, setSelectedZone] = useState<string>("3층");

  // 메모 확인 및 수정을 위한 상태
  const [isViewMemoModalOpen, setIsViewMemoModalOpen] = useState(false);
  const [selectedCarForMemo, setSelectedCarForMemo] = useState<any>(null);
  const [memoInput, setMemoInput] = useState("");

  // 실시간 차량/위치 데이터 및 검색 상태
  const [cars, setCars] = useState<Car[]>(initialCars || []);
  const [locations, setLocations] = useState<ParkingLocation[]>(
    initialLocations || [],
  );
  const [searchTerm, setSearchTerm] = useState("");

  // 드래그 앤 드롭 상태 (칸은 zone|matchKey|colNum 키로 식별)
  const [draggingCarId, setDraggingCarId] = useState<number | null>(null);
  const [dragOverCell, setDragOverCell] = useState<string | null>(null);

  const refreshData = async () => {
    const { data: c } = await supabase.from("car").select("*");
    const { data: l } = await supabase.from("parkinglocation").select("*");
    setCars(c || []);
    setLocations(l || []);
    router.refresh();
  };

  // 검색 필터 (차량번호 뒷자리 또는 모델명)
  const filteredCars = cars.filter((car: any) => {
    if (!searchTerm.trim()) return true;

    const cleanTerm = searchTerm.replace(/\s+/g, "").toLowerCase();
    const cleanCarNum = car.car_number.replace(/\s+/g, "").toLowerCase();
    const last4Digits = cleanCarNum.slice(-4);
    const modelMatch = car.model
      ? car.model.replace(/\s+/g, "").toLowerCase().includes(cleanTerm)
      : false;

    return (
      cleanCarNum.includes(cleanTerm) ||
      last4Digits.includes(cleanTerm) ||
      modelMatch
    );
  });

  // 검색어와 일치하는 차량이 실제로 어느 구역/자리에 있는지 (현재 보고 있는 구역과 무관하게)
  const hasSearch = searchTerm.trim().length > 0;
  const searchResults = hasSearch
    ? filteredCars.map((car: any) => ({
        car,
        loc:
          car.parking_location_id != null
            ? locations.find((l) => l.location_id === car.parking_location_id)
            : undefined,
      }))
    : [];

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
      alert("메모가 수정되었습니다.");
      setMemoInput("");
      setIsViewMemoModalOpen(false);
      setSelectedCarForMemo(null);
      await refreshData();
    }
  };

  // 해당 칸(zone/matchKey/colNum)에 대응하는 실제 parkinglocation row를 찾거나,
  // 처음 드롭되는 칸이면 새로 만들어서 location_id를 확보합니다.
  const resolveLocationId = async (
    zone: string,
    matchKey: string,
    colNum: number,
  ) => {
    const result = await resolveLocationIdShared(
      supabase,
      locations,
      zone,
      matchKey,
      colNum,
    );

    if ("error" in result) {
      alert("자리 정보 생성 실패: " + result.error);
      return null;
    }

    if (result.newLocation) {
      setLocations((prev) => [...prev, result.newLocation!]);
    }
    return result.locationId;
  };

  const moveCarToLocation = async (carId: number, targetLocationId: number) => {
    const car = cars.find((c) => c.car_id === carId);
    if (!car) return;

    const beforeLocationId = car.parking_location_id ?? null;
    if (beforeLocationId === targetLocationId) return;

    const { error } = await supabase
      .from("car")
      .update({ parking_location_id: targetLocationId })
      .eq("car_id", carId);

    if (error) {
      alert("위치 이동 실패: " + error.message);
      return;
    }

    await supabase.from("locationhistory").insert([
      {
        car_id: carId,
        user_id: 1,
        before_location_id: beforeLocationId,
        after_location_id: targetLocationId,
      },
    ]);

    await refreshData();
  };

  const handleDragStart = (e: React.DragEvent, carId: number) => {
    e.dataTransfer.setData("text/plain", String(carId));
    e.dataTransfer.effectAllowed = "move";
    setDraggingCarId(carId);
  };

  const handleDragEnd = () => {
    setDraggingCarId(null);
    setDragOverCell(null);
  };

  const handleDragOver = (e: React.DragEvent, cellKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverCell !== cellKey) setDragOverCell(cellKey);
  };

  const handleDragLeave = (cellKey: string) => {
    setDragOverCell((key) => (key === cellKey ? null : key));
  };

  const handleDrop = async (
    e: React.DragEvent,
    zone: string,
    matchKey: string,
    colNum: number,
    occupiedByCarId?: number,
  ) => {
    e.preventDefault();
    setDragOverCell(null);
    const carId = Number(e.dataTransfer.getData("text/plain"));
    if (!carId) return;
    if (occupiedByCarId && occupiedByCarId !== carId) return;

    const targetLocationId = await resolveLocationId(zone, matchKey, colNum);
    if (targetLocationId == null) return;
    await moveCarToLocation(carId, targetLocationId);
  };

  const { rows, cols } = getTableLayout(selectedZone);

  return (
    <div>
      {/* 헤더 */}
      <header className="mb-5 border-b border-gray-200 pb-5">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">
          📊 주차장 바둑판 상황판
        </h1>
        <p className="mt-2 text-sm sm:text-base text-gray-500">
          차량 카드를 드래그해서 원하는 자리로 옮기면 바로 위치가 저장됩니다.
        </p>
      </header>

      {/* 1. 주차장 토글 바 */}
      <div className="mb-5 overflow-x-auto whitespace-nowrap pb-2 scrollbar-hide">
        <div className="inline-flex gap-2 bg-gray-200 p-1.5 rounded-2xl border border-gray-300 shadow-inner">
          {PARKING_ZONES.map((zone) => (
            <button
              key={zone}
              onClick={() => setSelectedZone(zone)}
              className={`px-4 sm:px-6 py-3 rounded-xl text-sm sm:text-base font-black transition-all ${
                selectedZone === zone
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"
              }`}
            >
              {zone}
            </button>
          ))}
        </div>
      </div>

      {/* 검색 바 */}
      <div className="mb-5">
        <input
          type="text"
          placeholder="차량번호 뒷자리나 모델명 검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full lg:w-1/3 rounded-xl border-2 border-gray-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none shadow-sm text-black"
        />
      </div>

      {/* 검색 결과: 검색된 차량이 실제로 어느 구역에 있는지 바로 알려줍니다 */}
      {hasSearch && (
        <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50/60 p-4 max-w-6xl">
          {searchResults.length === 0 ? (
            <p className="text-sm text-gray-500">검색 결과가 없습니다.</p>
          ) : (
            <ul className="space-y-2">
              {searchResults.map(({ car, loc }: any) => (
                <li
                  key={car.car_id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 shadow-sm"
                >
                  <span className="text-sm">
                    <span className="font-black text-gray-900">
                      {car.car_number}
                    </span>
                    <span className="text-gray-400">
                      {" "}
                      · {car.model || "모델미상"}
                    </span>
                  </span>
                  {loc ? (
                    <button
                      type="button"
                      onClick={() => setSelectedZone(loc.section)}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-blue-700"
                    >
                      📍 {formatLocationText(loc)}
                      {loc.section !== selectedZone ? " · 이 구역 보기" : ""}
                    </button>
                  ) : (
                    <span className="text-xs font-bold text-gray-400">
                      위치 미지정
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* 2. 화이트보드 그리드를 그대로 본뜬 대형 고정 표(Table) */}
      <div className="bg-white rounded-2xl border-2 border-gray-200 shadow-sm overflow-hidden max-w-6xl">
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <h2 className="text-lg font-extrabold text-gray-900">
            📍 <span className="text-blue-600">{selectedZone}</span> 도면 모눈
            격자판
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left table-fixed min-w-[700px]">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-200 text-sm font-bold text-gray-600">
                <th className="w-32 p-3 text-center bg-yellow-100 border-r border-gray-200 font-black text-gray-900">
                  구역 / 라인
                </th>
                {cols.map((colNum) => (
                  <th
                    key={colNum}
                    className="p-3 text-center border-r border-gray-200"
                  >
                    {colNum}번 자리
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200">
              {rows.map((row) => (
                <tr
                  key={row.rowLabel}
                  className="h-28 hover:bg-gray-50/50 transition-colors"
                >
                  <td className="p-3 bg-yellow-300 border-r-2 border-gray-300 text-center font-black text-gray-900 text-base shadow-sm">
                    <div className="whitespace-pre-line leading-tight">
                      {selectedZone}
                    </div>
                    <div className="text-xs text-amber-900 mt-1 font-bold bg-yellow-400/80 px-1 py-0.5 rounded">
                      {row.rowLabel}
                    </div>
                  </td>

                  {cols.map((colNum) => {
                    const cellKey = `${selectedZone}|${row.matchKey}|${colNum}`;
                    const cellLocation = locations.find(
                      (l) =>
                        l.section === selectedZone &&
                        l.row === row.matchKey &&
                        l.spot === String(colNum),
                    );
                    const parkedCar = cellLocation
                      ? cars.find(
                          (c) => c.parking_location_id === cellLocation.location_id,
                        )
                      : undefined;
                    const matchedCar =
                      parkedCar && filteredCars.includes(parkedCar)
                        ? parkedCar
                        : undefined;

                    const isDragOver = dragOverCell === cellKey;
                    const isInvalidTarget =
                      isDragOver &&
                      draggingCarId != null &&
                      matchedCar != null &&
                      matchedCar.car_id !== draggingCarId;

                    return (
                      <td
                        key={colNum}
                        onDragOver={(e) => handleDragOver(e, cellKey)}
                        onDragLeave={() => handleDragLeave(cellKey)}
                        onDrop={(e) =>
                          handleDrop(
                            e,
                            selectedZone,
                            row.matchKey,
                            colNum,
                            matchedCar?.car_id,
                          )
                        }
                        className={`p-2 border-r border-gray-200 text-center align-middle transition-colors ${
                          matchedCar ? "bg-amber-50/40" : "bg-gray-50/30"
                        } ${isDragOver && !matchedCar ? "bg-blue-50" : ""}`}
                      >
                        {matchedCar ? (
                          <button
                            draggable
                            onDragStart={(e) =>
                              handleDragStart(e, matchedCar.car_id)
                            }
                            onDragEnd={handleDragEnd}
                            onClick={() => {
                              setSelectedCarForMemo({
                                ...matchedCar,
                                locationText: `${selectedZone} ${row.rowLabel} (${colNum}번)`,
                              });
                              setIsViewMemoModalOpen(true);
                            }}
                            className={`w-full h-24 p-2 bg-white border-2 rounded-xl shadow-sm text-left flex flex-col justify-between transition cursor-grab active:cursor-grabbing active:scale-95 group ${
                              draggingCarId === matchedCar.car_id
                                ? "opacity-40"
                                : "opacity-100"
                            } ${
                              isInvalidTarget
                                ? "border-red-400 bg-red-50"
                                : "border-amber-400 hover:border-blue-500"
                            }`}
                          >
                            <div>
                              <span className="text-[11px] font-bold text-gray-400 block truncate group-hover:text-blue-500">
                                {matchedCar.model || "모델미상"}
                              </span>
                              <span className="text-base font-black text-gray-900 block tracking-tight mt-0.5 leading-tight truncate">
                                {matchedCar.car_number}
                              </span>
                            </div>
                            <div className="w-full border-t border-gray-100 pt-1 flex justify-between items-center">
                              <span className="text-[10px] text-amber-700 font-bold bg-amber-100/70 px-1.5 py-0.5 rounded">
                                {row.matchKey}
                                {colNum}
                              </span>
                              {matchedCar.memo && (
                                <span className="text-xs">📝</span>
                              )}
                            </div>
                          </button>
                        ) : (
                          <div
                            className={`text-xs font-bold select-none py-8 border border-dashed rounded-xl h-24 flex items-center justify-center transition-colors ${
                              isDragOver
                                ? "border-blue-400 bg-blue-50 text-blue-500"
                                : "border-gray-200 bg-white/50 text-gray-300/70"
                            }`}
                          >
                            공석
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 화면 중앙 메모 작성/확인 팝업창 모달 */}
      {isViewMemoModalOpen && selectedCarForMemo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl text-black">
            <div className="flex justify-between items-start border-b pb-4 mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
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
            <div className="bg-gray-50 rounded-xl p-3.5 max-h-44 overflow-y-auto border border-gray-200 mb-4 text-sm">
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
                  className="py-3 bg-gray-100 hover:bg-gray-200 font-bold rounded-xl text-base text-center"
                >
                  닫기
                </button>
                <button
                  type="submit"
                  className="py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-base text-center"
                >
                  메모 저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
