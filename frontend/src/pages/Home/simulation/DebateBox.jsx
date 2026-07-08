import React from "react";
import { Bot, Send } from "lucide-react";

const DebateBox = ({
  debates,
  message,
  setMessage,
  transcript,
  setTranscript,
  setDebates,
}) => {
  const handleSend = () => {
    if (message.trim() === "") return;

    setTranscript([...transcript, message]);

    setDebates([
      ...debates,
      {
        speaker: "Bạn",
        text: message,
      },
      {
        speaker: "GPT-5",
        text: "AI đang phân tích lập luận của bạn...",
      },
    ]);

    setMessage("");
  };

  return (
    <div className="rounded-2xl bg-[#241F1A] border border-white/10 p-6">

      <div className="flex items-center gap-3 mb-5">

        <Bot className="text-[#D9C3A3]" />

        <h2 className="text-2xl font-bold">

          AI Debate

        </h2>

      </div>

      <div className="bg-[#1D1916] rounded-xl h-72 overflow-y-auto p-5">

        {debates.map((item, index) => (

          <div
            key={index}
            className="bg-[#2A241E] rounded-xl p-4 mb-4"
          >

            <div className="font-bold text-[#D9C3A3]">

              {item.speaker}

            </div>

            <div className="mt-2 leading-7">

              {item.text}

            </div>

          </div>

        ))}

      </div>

      <textarea
        rows={5}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Nhập lập luận của bạn..."
        className="mt-6 w-full rounded-xl bg-[#1D1916] border border-white/10 p-4 outline-none resize-none"
      />

      <button
        onClick={handleSend}
        className="mt-5 flex items-center gap-3 bg-[#D9C3A3] text-black px-6 py-3 rounded-xl font-bold hover:brightness-110"
      >
        <Send size={18} />

        Gửi lập luận

      </button>

    </div>
  );
};

export default DebateBox;