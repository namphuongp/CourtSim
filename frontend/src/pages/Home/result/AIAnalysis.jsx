import React from "react";
import { Bot } from "lucide-react";

const AIAnalysis = ({ selectedModels = [] }) => {

  const comments = {
    "GPT-5":
      "Lập luận logic, biết sử dụng chứng cứ nhưng cần phản biện mạnh mẽ hơn.",

    "Gemini 2.5":
      "Khả năng diễn đạt tốt, tuy nhiên nên trình bày ngắn gọn hơn.",

    Claude:
      "Phong cách tranh luận tự nhiên, phù hợp với môi trường phiên tòa.",

    DeepSeek:
      "Cần cải thiện tốc độ phản hồi khi đối đáp.",

    Qwen:
      "Đưa ra lập luận khá đầy đủ nhưng nên viện dẫn điều luật nhiều hơn.",
  };

  return (

    <div className="rounded-3xl bg-[#241F1A] border border-white/10 p-8">

      <div className="flex items-center gap-3 mb-6">

        <Bot className="text-[#D9C3A3]" />

        <h2 className="text-2xl font-bold">

          Nhận xét từ AI

        </h2>

      </div>

      <div className="space-y-5">

        {selectedModels.map((model) => (

          <div
            key={model}
            className="rounded-2xl bg-[#2B2620] p-5"
          >

            <h3 className="font-bold text-[#D9C3A3]">

              {model}

            </h3>

            <p className="text-[#A39684] mt-3 leading-7">

              {comments[model]}

            </p>

          </div>

        ))}

      </div>

    </div>

  );

};

export default AIAnalysis;