import React from "react";
import {
  CheckCircle,
  AlertTriangle,
  Lightbulb,
} from "lucide-react";

const ImprovementCard = () => {

  const strengths = [
    "Lập luận logic và rõ ràng.",
    "Biết sử dụng chứng cứ hợp lý.",
    "Tự tin khi trình bày trước phiên tòa.",
  ];

  const weaknesses = [
    "Phản biện chưa đủ sắc bén.",
    "Thiếu viện dẫn điều luật trong một số lập luận.",
    "Cần kiểm soát thời gian trả lời tốt hơn.",
  ];

  const suggestions = [
    "Đọc kỹ hồ sơ vụ án trước khi tranh luận.",
    "Luyện tập phản biện với nhiều AI hơn.",
    "Trích dẫn điều luật để tăng tính thuyết phục.",
    "Giữ bình tĩnh khi đối đáp.",
  ];

  return (

    <div className="rounded-3xl bg-[#241F1A] border border-white/10 p-8">

      <h2 className="text-2xl font-bold mb-8">

        Đánh giá & Cải thiện

      </h2>

      {/* Điểm mạnh */}

      <div className="mb-8">

        <div className="flex items-center gap-3 mb-4">

          <CheckCircle className="text-green-400" />

          <h3 className="text-xl font-bold">

            Điểm mạnh

          </h3>

        </div>

        <ul className="space-y-3">

          {strengths.map((item, index) => (

            <li
              key={index}
              className="text-[#A39684]"
            >

              • {item}

            </li>

          ))}

        </ul>

      </div>

      {/* Điểm yếu */}

      <div className="mb-8">

        <div className="flex items-center gap-3 mb-4">

          <AlertTriangle className="text-yellow-400" />

          <h3 className="text-xl font-bold">

            Điểm cần cải thiện

          </h3>

        </div>

        <ul className="space-y-3">

          {weaknesses.map((item, index) => (

            <li
              key={index}
              className="text-[#A39684]"
            >

              • {item}

            </li>

          ))}

        </ul>

      </div>

      {/* Gợi ý */}

      <div>

        <div className="flex items-center gap-3 mb-4">

          <Lightbulb className="text-[#D9C3A3]" />

          <h3 className="text-xl font-bold">

            Gợi ý từ AI

          </h3>

        </div>

        <ul className="space-y-3">

          {suggestions.map((item, index) => (

            <li
              key={index}
              className="text-[#A39684]"
            >

              • {item}

            </li>

          ))}

        </ul>

      </div>

    </div>

  );

};

export default ImprovementCard;