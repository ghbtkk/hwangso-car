"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function CarListPage() {
  const [cars, setCars] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // 모달 제어
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isMemoModalOpen, setIsMemoModalOpen] = useState(false);

  // 등록 모달 안에서 "신규 차량" / "기존 차량" 중 선택하는 탭
  const [registerMode, setRegisterMode] = useState<"new" | "existing">("new");
  const [selectedExistingCarId, setSelectedExistingCarId] = useState("");
  const [existingCarMemo, setExistingCarMemo] = useState("");

  // 선택된 관리 번호 및 차량
  const [selectedDisplayId, setSelectedDisplayId] = useState<number | null>(
    null,
  );
  const [selectedCar, setSelectedCar] = useState<any>(null);

  // 입력 폼 상태
  const [newCar, setNewCar] = useState({
    car_number: "",
    brand: "",
    model: "",
    color: "",
    memo: "",
  });
  const [memoText, setMemoText] = useState("");

  // 실시간으로 DB 데이터 불러오기
  const fetchCars = async () => {
    setIsLoading(true);
    const { data, error } = await supabase.from("car").select("*");
    if (!error && data) {
      setCars(data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchCars();
  }, []);

  // 1~300번 고정 배열 매핑 및 검색 필터링
  const displayRows = Array.from({ length: 300 }, (_, i) => {
    const displayId = i + 1;
    const car = cars.find((c: any) => c.display_id === displayId);
    return { displayId, car };
  }).filter((row) => {
    if (!searchTerm) return true;
    if (!row.car) return false;

    const cleanTerm = searchTerm.replace(/\s+/g, "");
    const cleanCarNum = row.car.car_number.replace(/\s+/g, "");
    return (
      cleanCarNum.includes(cleanTerm) ||
      cleanCarNum.slice(-4).includes(cleanTerm)
    );
  });

  // 차량 등록
  const handleAddCar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCar.car_number || selectedDisplayId === null) return;

    const { error } = await supabase.from("car").insert([
      {
        display_id: selectedDisplayId,
        car_number: newCar.car_number,
        brand: newCar.brand,
        model: newCar.model,
        color: newCar.color,
        status: "주차중",
        memo: newCar.memo
          ? `[최초입력 ${new Date().toLocaleString("ko-KR")}] ${newCar.memo}`
          : "",
      },
    ]);

    if (error) {
      alert("등록 실패: " + error.message);
    } else {
      alert(`${selectedDisplayId}번 자리에 차량이 등록되었습니다.`);
      setIsAddModalOpen(false);
      setNewCar({ car_number: "", brand: "", model: "", color: "", memo: "" });
      fetchCars();
    }
  };

  // 이미 DB에 있는 차량(대시보드 등에서 등록된 차량)을 이 관리번호에 배정
  const handleRegisterExistingCar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExistingCarId || selectedDisplayId === null) {
      return alert("등록할 차량을 선택해주세요.");
    }

    const target = cars.find(
      (c: any) => c.car_id === Number(selectedExistingCarId),
    );

    const note = existingCarMemo.trim();
    const newMemoLine = note
      ? `[${selectedDisplayId}번 자리 등록 ${new Date().toLocaleString("ko-KR")}] ${note}`
      : null;
    const updatedMemo = newMemoLine
      ? target?.memo
        ? `${target.memo}\n${newMemoLine}`
        : newMemoLine
      : target?.memo;

    const { error } = await supabase
      .from("car")
      .update({ display_id: selectedDisplayId, memo: updatedMemo })
      .eq("car_id", Number(selectedExistingCarId));

    if (error) {
      alert("등록 실패: " + error.message);
    } else {
      alert(`${selectedDisplayId}번 자리에 기존 차량이 등록되었습니다.`);
      setIsAddModalOpen(false);
      setSelectedExistingCarId("");
      setExistingCarMemo("");
      fetchCars();
    }
  };

  // 메모 누적 수정 (타임스탬프)
  const handleUpdateMemo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCar) return;

    const timestamp = new Date().toLocaleString("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

    const updatedMemo = selectedCar.memo
      ? `${selectedCar.memo}\n[${timestamp}] ${memoText}`
      : `[${timestamp}] ${memoText}`;

    const { error } = await supabase
      .from("car")
      .update({ memo: updatedMemo })
      .eq("car_id", selectedCar.car_id);

    if (error) {
      alert("메모 수정 실패: " + error.message);
    } else {
      alert("메모가 업데이트되었습니다.");
      setIsMemoModalOpen(false);
      setMemoText("");
      fetchCars();
    }
  };

  // 판매 완료 (삭제 -> 자리 비움)
  const handleDeleteCar = async (
    carId: number,
    displayId: number,
    carNumber: string,
  ) => {
    if (
      !confirm(
        `[${displayId}번 / ${carNumber}] 차량을 판매 완료 처리하시겠습니까?\n이 번호는 다시 빈 자리가 됩니다.`,
      )
    )
      return;

    const { error } = await supabase.from("car").delete().eq("car_id", carId);

    if (error) {
      alert("삭제 실패: " + error.message);
    } else {
      alert("판매 완료 처리되었습니다.");
      fetchCars();
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 text-center text-black font-semibold">
        데이터를 불러오는 중입니다...
      </div>
    );
  }

  return (
    <div className="text-black">
      <header className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-200 pb-5 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">
            📋 지정번호 차량 리스트 (1~300번)
          </h1>
          <p className="mt-2 text-sm sm:text-base text-gray-500">
            비어있는 번호를 확인하고 차량을 등록/삭제할 수 있는 관리 대장입니다.
          </p>
        </div>
      </header>

      {/* 검색 바 */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="차량 번호 전체 또는 뒤 4자리 검색"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full lg:w-1/3 rounded-xl border-2 border-gray-300 px-4 py-3.5 text-base bg-white focus:outline-none focus:border-blue-500 shadow-sm placeholder-gray-400"
        />
      </div>

      {/* 🖥️ 데스크톱 화면 표 형태 */}
      <div className="hidden sm:block bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-auto max-h-[75vh]">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-100 text-xs text-gray-700 font-bold uppercase sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-center w-24">관리번호</th>
                <th className="px-4 py-3 w-40">차량번호</th>

                <th className="px-4 py-3">비고란 (메모 히스토리)</th>
                <th className="px-4 py-3 w-44 text-center">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {displayRows.map(({ displayId, car }) => (
                <tr
                  key={displayId}
                  className={car ? "hover:bg-gray-50" : "bg-gray-50/40"}
                >
                  <td className="px-4 py-3 text-center font-bold text-gray-900 bg-gray-50/50">
                    {displayId}번
                  </td>
                  <td className="px-4 py-3">
                    {car ? (
                      <span className="font-semibold text-gray-900">
                        {car.car_number}
                      </span>
                    ) : (
                      <span className="text-gray-400">❌ 비어 있음</span>
                    )}
                  </td>

                  <td className="px-4 py-3 text-xs text-gray-600 whitespace-pre-line leading-relaxed">
                    {car?.memo || (
                      <span className="text-gray-300">메모 없음</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {car ? (
                      <div className="flex justify-center gap-1.5">
                        <button
                          onClick={() => {
                            setSelectedCar(car);
                            setMemoText("");
                            setIsMemoModalOpen(true);
                          }}
                          className="rounded bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-100"
                        >
                          📝 메모추가
                        </button>
                        <button
                          onClick={() =>
                            handleDeleteCar(
                              car.car_id,
                              displayId,
                              car.car_number,
                            )
                          }
                          className="rounded bg-red-50 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-100"
                        >
                          💰 판매완료
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setSelectedDisplayId(displayId);
                          setRegisterMode("new");
                          setSelectedExistingCarId("");
                          setExistingCarMemo("");
                          setIsAddModalOpen(true);
                        }}
                        className="rounded bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-700"
                      >
                        ➕ 등록
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 📱 모바일 화면 카드 리스트 형태 */}
      <div className="block sm:hidden space-y-3">
        {displayRows.map(({ displayId, car }) => (
          <div
            key={displayId}
            className={`rounded-xl border p-4 shadow-sm ${
              car
                ? "border-gray-200 bg-white"
                : "border-dashed border-gray-200 bg-gray-50/50"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-black text-gray-900">
                {displayId}번
              </span>
              {car ? (
                <span className="text-base font-bold text-gray-900">
                  {car.car_number}
                </span>
              ) : (
                <span className="text-sm text-gray-400">❌ 비어 있음</span>
              )}
            </div>

            {car && (
              <div className="mt-2.5 rounded-lg bg-gray-50 p-2.5 text-xs text-gray-600 whitespace-pre-line leading-relaxed border border-gray-100">
                {car.memo || <span className="text-gray-300">메모 없음</span>}
              </div>
            )}

            <div className="mt-3">
              {car ? (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setSelectedCar(car);
                      setMemoText("");
                      setIsMemoModalOpen(true);
                    }}
                    className="rounded-lg bg-blue-50 py-2.5 text-xs font-semibold text-blue-600 active:bg-blue-100"
                  >
                    📝 메모추가
                  </button>
                  <button
                    onClick={() =>
                      handleDeleteCar(car.car_id, displayId, car.car_number)
                    }
                    className="rounded-lg bg-red-50 py-2.5 text-xs font-semibold text-red-600 active:bg-red-100"
                  >
                    💰 판매완료
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setSelectedDisplayId(displayId);
                    setRegisterMode("new");
                    setSelectedExistingCarId("");
                    setExistingCarMemo("");
                    setIsAddModalOpen(true);
                  }}
                  className="w-full rounded-lg bg-green-600 py-2.5 text-xs font-semibold text-white active:bg-green-700"
                >
                  ➕ 등록
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* [모달창 코드 생략 - 위/아래 동일하게 정상 작동하도록 내장되어 있습니다] */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl text-black">
            <h3 className="text-lg font-bold mb-2">
              📌 {selectedDisplayId}번에 차량 등록
            </h3>

            <div className="mb-4 flex gap-2 rounded-xl bg-gray-100 p-1">
              <button
                type="button"
                onClick={() => setRegisterMode("new")}
                className={`flex-1 rounded-lg py-2 text-sm font-bold transition ${
                  registerMode === "new"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-500"
                }`}
              >
                신규 차량
              </button>
              <button
                type="button"
                onClick={() => setRegisterMode("existing")}
                className={`flex-1 rounded-lg py-2 text-sm font-bold transition ${
                  registerMode === "existing"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-500"
                }`}
              >
                기존 차량
              </button>
            </div>

            {registerMode === "new" ? (
              <form onSubmit={handleAddCar} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    차량 번호 *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="예: 12가 3456"
                    value={newCar.car_number}
                    onChange={(e) =>
                      setNewCar({ ...newCar, car_number: e.target.value })
                    }
                    className="w-full border-2 rounded-xl p-3 text-base bg-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      브랜드
                    </label>
                    <input
                      type="text"
                      placeholder="예: 현대"
                      value={newCar.brand}
                      onChange={(e) =>
                        setNewCar({ ...newCar, brand: e.target.value })
                      }
                      className="w-full border-2 rounded-xl p-3 text-base bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      모델명
                    </label>
                    <input
                      type="text"
                      placeholder="예: 아반떼"
                      value={newCar.model}
                      onChange={(e) =>
                        setNewCar({ ...newCar, model: e.target.value })
                      }
                      className="w-full border-2 rounded-xl p-3 text-base bg-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    색상
                  </label>
                  <input
                    type="text"
                    placeholder="예: 흰색"
                    value={newCar.color}
                    onChange={(e) =>
                      setNewCar({ ...newCar, color: e.target.value })
                    }
                    className="w-full border-2 rounded-xl p-3 text-base bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    초기 메모
                  </label>
                  <input
                    type="text"
                    placeholder="특이사항 적기"
                    value={newCar.memo}
                    onChange={(e) =>
                      setNewCar({ ...newCar, memo: e.target.value })
                    }
                    className="w-full border-2 rounded-xl p-3 text-base bg-white"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-bold transition-colors"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-bold transition-colors"
                  >
                    등록 완료
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleRegisterExistingCar} className="space-y-4">
                {(() => {
                  const availableCars = cars.filter(
                    (c: any) => c.display_id == null,
                  );
                  if (availableCars.length === 0) {
                    return (
                      <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-400">
                        관리번호가 없는 기존 차량이 없습니다. 대시보드에서
                        먼저 차량을 등록해주세요.
                      </p>
                    );
                  }
                  return (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        등록할 기존 차량 *
                      </label>
                      <select
                        required
                        value={selectedExistingCarId}
                        onChange={(e) =>
                          setSelectedExistingCarId(e.target.value)
                        }
                        className="w-full border-2 rounded-xl p-3 text-base bg-white"
                      >
                        <option value="">차량 선택</option>
                        {availableCars.map((c: any) => (
                          <option key={c.car_id} value={c.car_id}>
                            {c.car_number} · {c.model || "모델미상"} (
                            {c.brand || "브랜드미상"})
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })()}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    등록 메모 (선택)
                  </label>
                  <input
                    type="text"
                    placeholder="특이사항 적기"
                    value={existingCarMemo}
                    onChange={(e) => setExistingCarMemo(e.target.value)}
                    className="w-full border-2 rounded-xl p-3 text-base bg-white"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-bold transition-colors"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={
                      cars.filter((c: any) => c.display_id == null).length === 0
                    }
                    className="px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
                  >
                    등록 완료
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {isMemoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl text-black">
            <h3 className="text-lg font-bold mb-1">📝 비고란 메모 추가</h3>
            <p className="text-xs text-gray-500 mb-4">
              {selectedCar?.display_id}번 차량 ({selectedCar?.car_number})
            </p>
            <form onSubmit={handleUpdateMemo} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  새로운 메모 내용 (자동 시간스탬프)
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="내용 입력..."
                  value={memoText}
                  onChange={(e) => setMemoText(e.target.value)}
                  className="w-full border-2 rounded-xl p-3 text-base bg-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsMemoModalOpen(false)}
                  className="px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-bold transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-colors"
                >
                  메모 기록
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
