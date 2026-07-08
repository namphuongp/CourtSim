import React from "react";
import { useNavigate } from "react-router-dom";

const FinishButton = ({
  selectedCase,
  selectedRole,
  difficulty,
  selectedModels,
  transcript,
  debates,
  time,
}) => {
  const navigate = useNavigate();

  return (
    <button
      onClick={() =>
        navigate("/result", {
          state: {
            selectedCase,
            selectedRole,
            difficulty,
            selectedModels,
            transcript,
            debates,
            time,
          },
        })
      }
      className="w-full mt-8 bg-green-500 hover:bg-green-600 py-4 rounded-xl font-bold text-lg"
    >
      KẾT THÚC PHIÊN TÒA
    </button>
  );
};

export default FinishButton;