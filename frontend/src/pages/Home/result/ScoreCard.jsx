import React from "react";
import { Award } from "lucide-react";

const ScoreCard = ({ score = 8.6 }) => {

  let level = "Khá";

  if (score >= 9) {

    level = "Xuất sắc";

  } else if (score >= 8) {

    level = "Tốt";

  } else if (score >= 6.5) {

    level = "Khá";

  } else {

    level = "Cần cải thiện";

  }

  return (

    <div className="rounded-3xl bg-[#241F1A] border border-white/10 p-8">

      <div className="flex items-center gap-3 mb-6">

        <Award className="text-[#D9C3A3]" />

        <h2 className="text-2xl font-bold">

          Điểm đánh giá

        </h2>

      </div>

      <div className="text-center">

        <h1 className="text-7xl font-bold text-[#D9C3A3]">

          {score}/10

        </h1>

        <p className="mt-4 text-xl">

          {level}

        </p>

      </div>

      <div className="mt-8">

        <div className="w-full h-4 rounded-full bg-[#2F2A24]">

          <div
            style={{ width: `${score * 10}%` }}
            className="h-4 rounded-full bg-[#D9C3A3]"
          />

        </div>

      </div>

      <p className="text-center text-[#A39684] mt-6 leading-7">

        AI đánh giá dựa trên lập luận, phản biện,
        cách sử dụng chứng cứ và kỹ năng tranh luận.

      </p>

    </div>

  );

};

export default ScoreCard;