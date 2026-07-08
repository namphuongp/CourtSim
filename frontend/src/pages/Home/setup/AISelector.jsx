import React from "react";
import { Bot, CheckCircle } from "lucide-react";

const AISelector = ({
  aiModels,
  selectedModels,
  toggleModel,
}) => {
  return (
    <div className="mt-14">

      <div className="flex items-center gap-3 mb-6">

        <Bot className="text-[#D9C3A3]" />

        <h2 className="text-2xl font-bold">

          AI Debate Models

        </h2>

      </div>

      <div className="grid md:grid-cols-3 gap-5">

        {aiModels.map((model) => (

          <div
            key={model}
            onClick={() => toggleModel(model)}
            className={`cursor-pointer rounded-2xl border p-6 transition-all

            ${
              selectedModels.includes(model)
                ? "border-[#D9C3A3] bg-[#2A241E]"
                : "border-white/10 bg-[#201B17] hover:border-[#D9C3A3]"
            }

            `}
          >

            <div className="flex justify-between items-center">

              <div>

                <h3 className="font-bold">

                  {model}

                </h3>

                <p className="text-[#A39684] text-sm mt-2">

                  AI sẽ tham gia tranh luận.

                </p>

              </div>

              {selectedModels.includes(model) && (

                <CheckCircle
                  size={22}
                  className="text-green-400"
                />

              )}

            </div>

          </div>

        ))}

      </div>

    </div>
  );
};

export default AISelector;