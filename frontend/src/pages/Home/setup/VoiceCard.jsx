import React from "react";
import { Mic, MicOff } from "lucide-react";

const VoiceCard = ({
  voiceEnabled,
  setVoiceEnabled,
}) => {
  return (
    <div className="mt-14">

      <div className="rounded-2xl border border-[#D9C3A3] bg-[#2A241E] p-7">

        <div className="flex items-center justify-between">

          <div className="flex items-center gap-3">

            <Mic className="text-[#D9C3A3]" />

            <h2 className="text-2xl font-bold">

              Voice To Text

            </h2>

          </div>

          <button
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            className={`px-6 py-3 rounded-xl font-bold transition-all

            ${
              voiceEnabled
                ? "bg-red-500 hover:bg-red-600"
                : "bg-[#D9C3A3] text-black hover:brightness-110"
            }

            `}
          >

            {voiceEnabled ? "Tắt Voice" : "Bật Voice"}

          </button>

        </div>

        <p className="text-[#A39684] mt-5 leading-7">

          CourtSim sử dụng

          <span className="text-[#D9C3A3] font-semibold">

            {" "}Whisper Large V3 Turbo{" "}

          </span>

          để chuyển lời nói thành văn bản trong suốt phiên mô phỏng.

        </p>

        {voiceEnabled && (

          <div className="flex items-center gap-3 mt-6">

            <MicOff className="text-red-400" />

            <span className="text-red-400 font-semibold">

              Voice đang hoạt động...

            </span>

          </div>

        )}

      </div>

    </div>
  );
};

export default VoiceCard;