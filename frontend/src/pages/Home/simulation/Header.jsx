import React from "react";
import { ArrowLeft, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Header = ({ minutes, seconds }) => {
  const navigate = useNavigate();

  return (
    <div className="border-b border-white/10 bg-[#221D18]">

      <div className="max-w-7xl mx-auto flex items-center justify-between px-8 py-5">

        <div className="flex items-center gap-4">

          <button
            onClick={() => navigate("/setup")}
            className="p-2 rounded-xl bg-[#2A241E] hover:bg-[#3A322C]"
          >
            <ArrowLeft size={20} />
          </button>

          <div>

            <h1 className="text-3xl font-bold">

              Court Simulation

            </h1>

            <p className="text-[#A39684] mt-1">

              Phiên mô phỏng đang diễn ra

            </p>

          </div>

        </div>

        <div className="flex items-center gap-3">

          <Clock className="text-[#D9C3A3]" />

          <span className="text-xl font-bold">

            {minutes.toString().padStart(2, "0")}:

            {seconds.toString().padStart(2, "0")}

          </span>

        </div>

      </div>

    </div>
  );
};

export default Header;