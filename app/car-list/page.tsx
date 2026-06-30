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
    <div className="min-h-screen bg-gray-50 p-6 font-sans text-black">
      <header className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-4 gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            📋 지정번호 차량 리스트 (1~300번)
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            비어있는 번호를 확인하고 차량을 등록/삭제할 수 있는 관리 대장입니다.
          </p>
        </div>
        <a
          href="/"
          className="text-sm bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-lg font-medium"
        >
          🏠 메인 화면으로 돌아가기
        </a>
      </header>

      {/* 검색 바 */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="차량 번호 전체 또는 뒤 4자리 검색 (빈 번호는 숨겨집니다)"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full lg:w-1/3 rounded-xl border border-gray-300 px-4 py-2.5 text-sm bg-white focus:outline-none focus:border-blue-500 shadow-sm"
        />
      </div>

      {/* 표 리스트 */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-y-auto max-h-[75vh]">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-100 text-xs text-gray-700 font-bold uppercase sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-center w-24">관리번호</th>
                <th className="px-4 py-3 w-40">차량번호</th>
                <th className="px-4 py-3 w-44">차종 (브랜드)</th>
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
                  <td className="px-4 py-3 text-gray-700">
                    {car ? `${car.model} (${car.brand})` : "-"}
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

      {/* [모달창 코드 생략 - 위/아래 동일하게 정상 작동하도록 내장되어 있습니다] */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl text-black">
            <h3 className="text-lg font-bold mb-2">
              📌 {selectedDisplayId}번에 새 차량 등록
            </h3>
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
                  className="w-full border p-2 rounded bg-white"
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
                    className="w-full border p-2 rounded bg-white"
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
                    className="w-full border p-2 rounded bg-white"
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
                  className="w-full border p-2 rounded bg-white"
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
                  className="w-full border p-2 rounded bg-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 rounded text-sm"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded text-sm"
                >
                  등록 완료
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isMemoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl text-black">
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
                  className="w-full border p-2 rounded bg-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsMemoModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 rounded text-sm"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded text-sm"
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
