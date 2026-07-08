import React from "react";
import { CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

const SummaryCard = ({
  selectedCase,
  selectedRole,
  selectedModels,
  difficulty,
  voiceEnabled,
  plan,
}) => {
  const navigate = useNavigate();

  const handleStart = () => {
    navigate("/simulation", {
      state: {
        selectedCase,
        selectedRole,
        selectedModels,
        difficulty,
        voiceEnabled,
        plan,
      },
    });
  };

  return (
    <div className="mt-14">

      <div className="rounded-3xl bg-[#241F1A] border border-white/10 p-8">

        <div className="flex items-center gap-3 mb-6">

          <CheckCircle className="text-[#D9C3A3]" />

          <h2 className="text-2xl font-bold">

            Tóm tắt phiên mô phỏng

          </h2>

        </div>

        <div className="space-y-4">

          <div className="flex justify-between">

            <span className="text-[#A39684]">

              Vụ án

            </span>

            <span>

              {selectedCase?.title || "Chưa chọn"}

            </span>

          </div>

          <div className="flex justify-between">

            <span className="text-[#A39684]">

              Vai trò

            </span>

            <span>

              {selectedRole || "Chưa chọn"}

            </span>

          </div>

          <div className="flex justify-between">

            <span className="text-[#A39684]">

              AI Models

            </span>

            <span>

              {selectedModels.length}

            </span>

          </div>

          <div className="flex justify-between">

            <span className="text-[#A39684]">

              Danh sách AI

            </span>

            <span>

              {selectedModels.join(", ")}

            </span>

          </div>

          <div className="flex justify-between">

            <span className="text-[#A39684]">

              Độ khó

            </span>

            <span>

              {difficulty}

            </span>

          </div>

          <div className="flex justify-between">

            <span className="text-[#A39684]">

              Voice To Text

            </span>

            <span>

              {voiceEnabled ? "Đã bật" : "Chưa bật"}

            </span>

          </div>

          <div className="flex justify-between">

            <span className="text-[#A39684]">

              Gói sử dụng

            </span>

            <span>

              {plan}

            </span>

          </div>

        </div>

        <button
          disabled={!selectedCase || !selectedRole}
          onClick={handleStart}
          className="w-full mt-8 bg-[#D9C3A3] text-black py-4 rounded-xl font-bold text-lg hover:brightness-110 disabled:opacity-40"
        >

          BẮT ĐẦU MÔ PHỎNG

        </button>

      </div>

    </div>
  );
};

export default SummaryCard;