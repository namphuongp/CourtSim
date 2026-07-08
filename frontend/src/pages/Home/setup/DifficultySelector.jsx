import React from "react";

const DifficultySelector = ({
  difficulty,
  setDifficulty,
}) => {
  const levels = [
    {
      id: "Easy",
      title: "Easy",
      description: "AI phản biện ở mức cơ bản."
    },
    {
      id: "Medium",
      title: "Medium",
      description: "Mức độ cân bằng, phù hợp luyện tập."
    },
    {
      id: "Hard",
      title: "Hard",
      description: "AI tranh luận mạnh và khó hơn."
    },
  ];

  return (
    <div className="mt-14">

      <h2 className="text-2xl font-bold mb-6">

        Độ khó phiên mô phỏng

      </h2>

      <div className="grid md:grid-cols-3 gap-5">

        {levels.map((level) => (

          <div
            key={level.id}
            onClick={() => setDifficulty(level.id)}
            className={`cursor-pointer rounded-2xl border p-6 transition

            ${
              difficulty === level.id
                ? "border-[#D9C3A3] bg-[#2A241E]"
                : "border-white/10 bg-[#201B17] hover:border-[#D9C3A3]"
            }

            `}
          >

            <h3 className="text-xl font-bold">

              {level.title}

            </h3>

            <p className="text-[#A39684] mt-3 leading-7">

              {level.description}

            </p>

          </div>

        ))}

      </div>

    </div>
  );
};

export default DifficultySelector;