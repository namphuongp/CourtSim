import React from "react";
import { Mic, MicOff } from "lucide-react";

const VoiceRecorder = ({ voiceEnabled, setVoiceEnabled }) => {
  return (
    <div className="rounded-2xl bg-[#241F1A] border border-white/10 p-6">

      <div className="flex items-center justify-between">

        <div className="flex items-center gap-3">

          <Mic className="text-[#D9C3A3]" />

          <h2 className="text-xl font-bold">

            Voice To Text

          </h2>

        </div>

        <button
          onClick={() => setVoiceEnabled(!voiceEnabled)}
          className={`px-6 py-3 rounded-xl font-bold transition-all duration-300 ${
            voiceEnabled
              ? "bg-red-500 hover:bg-red-600"
              : "bg-[#D9C3A3] text-black hover:brightness-110"
          }`}
        >
          {voiceEnabled ? "Dừng ghi âm" : "Bật ghi âm"}
        </button>

      </div>

      <p className="text-[#A39684] mt-5">

        CourtSim sử dụng

        <span className="text-[#D9C3A3] font-semibold">

          {" "}Whisper Large V3 Turbo{" "}

        </span>

        để chuyển lời nói thành văn bản.

      </p>

      {voiceEnabled && (

        <div className="mt-8 flex items-center gap-4">

          <div className="w-4 h-4 rounded-full bg-red-500 animate-pulse"></div>

          <MicOff className="text-red-400" />

          <span className="text-red-400 font-semibold">

            Đang ghi âm...

          </span>

        </div>

      )}

    </div>
  );
};

export default VoiceRecorder;