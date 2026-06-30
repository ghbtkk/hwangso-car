"use client";

import React, { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function Dashboard({
  initialCars,
  locations,
  initialHistories,
  users,
}: any) {
  const router = useRouter();

  // 🌟 메모 확인 및 수정을 위한 상태
  const [isViewMemoModalOpen, setIsViewMemoModalOpen] = useState(false);
  const [selectedCarForMemo, setSelectedCarForMemo] = useState<any>(null);
  const [memoInput, setMemoInput] = useState(""); // 🌟 메모 수정 입력값 상태

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
    parking_location_id: "",
  });
  // 이동 폼 상태
  const [targetLocationId, setTargetLocationId] = useState("");

  // 데이터 수강(리프레시) 함수
  const refreshData = async () => {
    const { data: c } = await supabase.from("car").select("*");
    const { data: h } = await supabase
      .from("locationhistory")
      .select("*")
      .order("changed_at", { ascending: false })
      .limit(5);

    // 조인 데이터 재가공
    const updatedCars =
      c?.map((car) => {
        const loc = locations?.find(
          (l: any) => l.location_id === car.parking_location_id,
        );
        return {
          ...car,
          locationText: loc
            ? `${loc.section} ${loc.row}열 (${loc.spot}번)`
            : "위치 지정 없음",
        };
      }) || [];

    const updatedHistories =
      h?.map((history) => {
        const car = c?.find((carItem) => carItem.car_id === history.car_id);
        const user = users?.find((u: any) => u.user_id === history.user_id);
        const beforeLoc = locations?.find(
          (l: any) => l.location_id === history.before_location_id,
        );
        const afterLoc = locations?.find(
          (l: any) => l.location_id === history.after_location_id,
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

  // 1. 차량 검색 필터링 (전체 매칭 또는 뒤 4자리 매칭)
  const filteredCars = cars.filter((car: any) => {
    const cleanTerm = searchTerm.replace(/\s+/g, ""); // 공백 제거
    const cleanCarNum = car.car_number.replace(/\s+/g, "");
    const last4Digits = cleanCarNum.slice(-4); // 뒤 4자리

    return cleanCarNum.includes(cleanTerm) || last4Digits.includes(cleanTerm);
  });

  // 2. 새로운 차량 등록
  const handleAddCar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCar.car_number) return alert("차량 번호는 필수입니다.");

    const { error } = await supabase.from("car").insert([
      {
        car_number: newCar.car_number,
        brand: newCar.brand,
        model: newCar.model,
        color: newCar.color,
        status: "주차중",
        parking_location_id: newCar.parking_location_id
          ? parseInt(newCar.parking_location_id)
          : null,
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
        parking_location_id: "",
      });
      await refreshData();
    }
  };

  // 3. 차량 위치 이동 및 이력 저장 (트랜잭션 효과)
  const handleMoveCar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCar || !targetLocationId) return;

    const beforeLocationId = selectedCar.parking_location_id;
    const afterLocationId = parseInt(targetLocationId);

    // 3-1. 차량 테이블 주차 위치 업데이트
    const { error: carUpdateError } = await supabase
      .from("car")
      .update({ parking_location_id: afterLocationId })
      .eq("car_id", selectedCar.car_id);

    if (carUpdateError)
      return alert("위치 수정 실패: " + carUpdateError.message);

    // 3-2. 위치 변경 히스토리 테이블에 로그 추가 (임시로 1번 유저 '김철수'가 옮겼다고 가정)
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
    setTargetLocationId("");
    await refreshData();
  };

  // 4. 차량 판매 완료로 인한 삭제
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

  // 🌟 [추가] 5. 메모 수정 및 타임스탬프 추가 저장 함수
  const handleUpdateMemo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCarForMemo) return;
    if (!memoInput.trim()) return alert("메모 내용을 입력해주세요.");

    // 현재 날짜 및 시간 구하기 (예: 2026-06-30 22:54)
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    // 기존 메모가 있으면 줄바꿈 후 추가, 없으면 새로 작성
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

  // 통계 재계산
  const totalCars = cars.length;
  const parkingCars = cars.filter((c: any) => c.status === "주차중").length;

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans">
      {/* 상단 네비게이션 바 */}
      <header className="mb-8 flex items-center justify-between border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            중고차 주차 관리 시스템 🚗
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            차량 검색, 등록, 위치 변경, 판매 처리가 가능합니다.
          </p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
        >
          ➕ 새 차량 등록
        </button>
      </header>
      {/* 현황 통계 영역 */}
      <section className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
          <p className="text-sm font-medium text-gray-500">전체 보유 차량</p>
          <p className="mt-2 text-3xl font-semibold text-gray-900">
            {totalCars}대
          </p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
          <p className="text-sm font-medium text-gray-500">현재 주차 중</p>
          <p className="mt-2 text-3xl font-semibold text-green-600">
            {parkingCars}대
          </p>
        </div>
        <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
          <p className="text-sm font-medium text-gray-500">검색된 결과</p>
          <p className="mt-2 text-3xl font-semibold text-blue-600">
            {filteredCars.length}대
          </p>
        </div>
      </section>
      {/* 검색 바 */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="차량 번호 전체 또는 뒤 4자리를 입력하세요 (예: 3456)"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full lg:w-1/3 rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none shadow-sm text-black"
        />
      </div>
      <a
        href="/car-list"
        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-xl text-sm shadow-sm inline-block mb-4"
      >
        📋 지정번호 관리 대장 (1~300번) 보러가기 →
      </a>
      {/* 메인 콘텐츠 */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* 차량 목록 표 */}
        <section className="lg:col-span-2 rounded-xl bg-white p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            보유 차량 목록
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-500">
              <thead className="bg-gray-50 text-xs uppercase text-gray-700">
                <tr>
                  <th className="px-4 py-3">차량번호</th>
                  <th className="px-4 py-3">모델 (브랜드)</th>
                  <th className="px-4 py-3">현재 위치</th>
                  <th className="px-4 py-3 text-center">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredCars.map((car: any) => (
                  <tr key={car.car_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold">
                      <button
                        onClick={() => {
                          setSelectedCarForMemo(car);
                          setIsViewMemoModalOpen(true);
                        }}
                        className="text-blue-600 hover:text-blue-800 hover:underline text-left focus:outline-none"
                        title="클릭하여 메모 보기 및 수정"
                      >
                        {car.car_number}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-black">
                      {car.model} ({car.brand})
                    </td>
                    <td className="px-4 py-3 text-blue-600 font-medium">
                      {car.locationText}
                    </td>
                    <td className="px-4 py-3 flex justify-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedCar(car);
                          setIsMoveModalOpen(true);
                        }}
                        className="rounded bg-gray-100 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200"
                      >
                        📍 위치 이동
                      </button>
                      <button
                        onClick={() =>
                          handleDeleteCar(car.car_id, car.car_number)
                        }
                        className="rounded bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100"
                      >
                        💰 판매 완료
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredCars.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-gray-400"
                    >
                      일치하는 차량이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* 🌟 [수정] 차량 번호 클릭 시 나타나는 메모 확인 및 수정 모달창 */}
          {isViewMemoModalOpen && selectedCarForMemo && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
              <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl text-black">
                <div className="flex justify-between items-start border-b pb-3 mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">
                      📝 차량 비고/메모 관리
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {selectedCarForMemo.locationText}
                    </p>
                  </div>
                  <span className="text-sm font-semibold bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md">
                    {selectedCarForMemo.car_number}
                  </span>
                </div>

                {/* 1. 기존 메모 히스토리 영역 */}
                <label className="block text-xs font-semibold text-gray-500 mb-1">
                  기존 메모 기록
                </label>
                <div className="bg-gray-50 rounded-xl p-3 max-h-40 overflow-y-auto border border-gray-100 mb-4">
                  {selectedCarForMemo.memo ? (
                    <p className="text-xs text-gray-700 whitespace-pre-line leading-relaxed">
                      {selectedCarForMemo.memo}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-400 text-center py-4">
                      등록된 메모 기록이 없습니다.
                    </p>
                  )}
                </div>

                {/* 2. 새 메모 입력/수정 폼 영역 */}
                <form onSubmit={handleUpdateMemo}>
                  <div className="mb-4">
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      새로운 메모 추가 (날짜/시간 자동 기록)
                    </label>
                    <textarea
                      rows={3}
                      placeholder="추가할 메모나 비고 내용을 입력하세요..."
                      value={memoInput}
                      onChange={(e) => setMemoInput(e.target.value)}
                      className="w-full border rounded-xl p-2.5 text-sm focus:border-blue-500 focus:outline-none bg-white resize-none"
                    />
                  </div>

                  {/* 버튼 제어 영역 */}
                  <div className="flex justify-end gap-2 pt-2 border-t">
                    <button
                      type="button"
                      onClick={() => {
                        setIsViewMemoModalOpen(false);
                        setSelectedCarForMemo(null);
                        setMemoInput("");
                      }}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 font-medium rounded-xl text-sm transition-colors"
                    >
                      닫기
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-sm transition-colors"
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
        <section className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Recent Movement History
          </h2>
          <div className="flow-root">
            {histories.length > 0 ? (
              <ul className="-mb-8">
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
                        <div className="flex-1 min-w-0 pt-1.5">
                          <p className="text-sm font-semibold text-gray-900">
                            {history.carNumber}{" "}
                            <span className="font-normal text-gray-500">
                              ({history.worker})
                            </span>
                          </p>
                          <p className="text-xs text-gray-600 mt-0.5">
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
              <p className="text-sm text-gray-400 text-center py-8">
                최근 이동 기록이 없습니다.
              </p>
            )}
          </div>
        </section>
      </div>

      {/* 팝업 모달 1: 새 차량 등록 */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl text-black">
            <h3 className="text-lg font-bold mb-4">새 차량 등록하기</h3>
            <form onSubmit={handleAddCar} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
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
                  className="w-full border p-2 rounded"
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
                    className="w-full border p-2 rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    모델
                  </label>
                  <input
                    type="text"
                    placeholder="예: 아반떼"
                    value={newCar.model}
                    onChange={(e) =>
                      setNewCar({ ...newCar, model: e.target.value })
                    }
                    className="w-full border p-2 rounded"
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
                  className="w-full border p-2 rounded"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  초기 주차 위치
                </label>
                <select
                  value={newCar.parking_location_id}
                  onChange={(e) =>
                    setNewCar({
                      ...newCar,
                      parking_location_id: e.target.value,
                    })
                  }
                  className="w-full border p-2 rounded bg-white"
                >
                  <option value="">위치 선택 안함</option>
                  {locations?.map((l: any) => (
                    <option
                      key={l.location_id}
                      value={l.location_id}
                    >{`${l.section} ${l.row}-${l.spot}`}</option>
                  ))}
                </select>
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
                  className="px-4 py-2 bg-blue-600 text-white rounded text-sm"
                >
                  등록
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 팝업 모달 2: 차량 위치 이동 */}
      {isMoveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl text-black">
            <h3 className="text-lg font-bold mb-2">🚗 차량 위치 이동</h3>
            <p className="text-sm text-gray-500 mb-4">
              선택 차량:{" "}
              <span className="font-bold text-gray-900">
                {selectedCar?.car_number}
              </span>
            </p>
            <form onSubmit={handleMoveCar} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  새로운 주차 공간 선택
                </label>
                <select
                  required
                  value={targetLocationId}
                  onChange={(e) => setTargetLocationId(e.target.value)}
                  className="w-full border p-2 rounded bg-white"
                >
                  <option value="">이동할 주차 구역을 고르세요</option>
                  {locations
                    ?.filter(
                      (l: any) =>
                        l.location_id !== selectedCar?.parking_location_id,
                    )
                    .map((l: any) => (
                      <option
                        key={l.location_id}
                        value={l.location_id}
                      >{`${l.section} ${l.row}-${l.spot}`}</option>
                    ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsMoveModalOpen(false)}
                  className="px-4 py-2 bg-gray-100 rounded text-sm"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded text-sm"
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
