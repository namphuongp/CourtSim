import React from "react";
import {
  Clock,
  MessageSquare,
  Bot,
  FileText,
} from "lucide-react";

const Statistics = ({
  time = "27:35",
  transcriptCount = 18,
  debateCount = 35,
  selectedModels = [],
}) => {

  const stats = [
    {
      title: "Thời gian",
      value: time,
      icon: Clock,
    },
    {
      title: "Lượt Voice",
      value: transcriptCount,
      icon: FileText,
    },
    {
      title: "Lượt tranh luận",
      value: debateCount,
      icon: MessageSquare,
    },
    {
      title: "AI tham gia",
      value: selectedModels.length,
      icon: Bot,
    },
  ];

  return (

    <div className="rounded-3xl bg-[#241F1A] border border-white/10 p-8">

      <h2 className="text-2xl font-bold mb-8">

        Thống kê phiên mô phỏng

      </h2>

      <div className="grid md:grid-cols-2 gap-6">

        {stats.map((item, index) => {

          const Icon = item.icon;

          return (

            <div
              key={index}
              className="rounded-2xl bg-[#2A241E] p-6 flex items-center gap-5"
            >

              <div className="p-4 rounded-xl bg-[#332D27]">

                <Icon
                  size={28}
                  className="text-[#D9C3A3]"
                />

              </div>

              <div>

                <p className="text-[#A39684]">

                  {item.title}

                </p>

                <h3 className="text-2xl font-bold mt-1">

                  {item.value}

                </h3>

              </div>

            </div>

          );

        })}

      </div>

    </div>

  );

};

export default Statistics;