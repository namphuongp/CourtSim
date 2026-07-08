import React from "react";
import { FileText } from "lucide-react";

const Transcript = ({ transcript }) => {
  return (
    <div className="rounded-2xl bg-[#241F1A] border border-white/10 p-6">

      <div className="flex items-center gap-3 mb-5">

        <FileText className="text-[#D9C3A3]" />

        <h2 className="text-2xl font-bold">

          Biên bản phiên tòa

        </h2>

      </div>

      <div className="bg-[#1D1916] rounded-xl p-5 h-72 overflow-y-auto">

        {transcript.length === 0 ? (

          <p className="text-[#A39684]">

            Chưa có dữ liệu từ Voice To Text.

          </p>

        ) : (

          transcript.map((item, index) => (

            <div
              key={index}
              className="border-b border-white/10 pb-3 mb-3"
            >

              {item}

            </div>

          ))

        )}

      </div>

    </div>
  );
};

export default Transcript;