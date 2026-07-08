import React from "react";
import { Crown, Star, User } from "lucide-react";

const plans = [
  {
    id: "Free",
    title: "Free",
    icon: User,
    description: "Sử dụng các chức năng cơ bản của CourtSim.",
    features: [
      "1 AI tham gia tranh luận",
      "Voice To Text",
      "Xem kết quả phiên tòa",
    ],
  },
  {
    id: "Plus",
    title: "Plus",
    icon: Star,
    description: "Nâng cao trải nghiệm học tập.",
    features: [
      "3 AI Debate",
      "Đánh giá chi tiết",
      "Lưu lịch sử mô phỏng",
    ],
  },
  {
    id: "Pro",
    title: "Pro",
    icon: Crown,
    description: "Đầy đủ tính năng chuyên nghiệp.",
    features: [
      "Không giới hạn AI",
      "Ghi lại toàn bộ phiên tòa",
      "Xuất PDF",
      "Thống kê nâng cao",
    ],
  },
];

const PlanSelector = ({ plan, setPlan }) => {
  return (
    <div className="mt-14">

      <h2 className="text-2xl font-bold mb-6">

        Chọn gói sử dụng

      </h2>

      <div className="grid md:grid-cols-3 gap-6">

        {plans.map((item) => {

          const Icon = item.icon;

          return (

            <div
              key={item.id}
              onClick={() => setPlan(item.id)}
              className={`cursor-pointer rounded-2xl border p-6 transition

              ${
                plan === item.id
                  ? "border-[#D9C3A3] bg-[#2A241E]"
                  : "border-white/10 bg-[#201B17] hover:border-[#D9C3A3]"
              }

              `}
            >

              <div className="flex items-center gap-3 mb-5">

                <Icon
                  size={30}
                  className="text-[#D9C3A3]"
                />

                <h3 className="text-2xl font-bold">

                  {item.title}

                </h3>

              </div>

              <p className="text-[#A39684] mb-5">

                {item.description}

              </p>

              <ul className="space-y-3">

                {item.features.map((feature, index) => (

                  <li
                    key={index}
                    className="text-sm flex items-center gap-2"
                  >

                    <span className="w-2 h-2 rounded-full bg-[#D9C3A3]" />

                    {feature}

                  </li>

                ))}

              </ul>

            </div>

          );

        })}

      </div>

    </div>
  );
};

export default PlanSelector;