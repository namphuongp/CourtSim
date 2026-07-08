import React from "react";
import { FileText, Copy } from "lucide-react";

const TranscriptCard = ({ transcript = [] }) => {

  const handleCopy = () => {

    const text = transcript
      .map((item) => item.text || item)
      .join("\n");

    navigator.clipboard.writeText(text);

    alert("Đã sao chép biên bản.");

  };

  return (

    <div className="rounded-3xl bg-[#241F1A] border border-white/10 p-8">

      <div className="flex justify-between items-center mb-6">

        <div className="flex items-center gap-3">

          <FileText className="text-[#D9C3A3]" />

          <h2 className="text-2xl font-bold">

            Biên bản phiên tòa

          </h2>

        </div>

        <button
          onClick={handleCopy}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2A241E] hover:bg-[#332D27]"
        >

          <Copy size={18} />

          Sao chép

        </button>

      </div>

      <div className="h-96 overflow-y-auto rounded-2xl bg-[#1E1A17] border border-white/5 p-6">

        {transcript.length === 0 ? (

          <p className="text-[#8E8478]">

            Chưa có dữ liệu biên bản.

          </p>

        ) : (

          <div className="space-y-4">

            {transcript.map((item, index) => (

              <div
                key={index}
                className="pb-4 border-b border-white/5"
              >

                <p className="leading-7">

                  {item.text || item}

                </p>

              </div>

            ))}

          </div>

        )}

      </div>

    </div>

  );

};

export default TranscriptCard;