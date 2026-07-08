import React from "react";
import { ArrowLeft, Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Header = () => {

  const navigate = useNavigate();

  return (

    <div className="border-b border-white/10 bg-[#221D18]">

      <div className="max-w-7xl mx-auto flex items-center justify-between px-8 py-5">

        <div className="flex items-center gap-4">

          <button
            onClick={() => navigate("/dashboard")}
            className="p-2 rounded-xl bg-[#2A241E] hover:bg-[#3A322C]"
          >

            <ArrowLeft size={20}/>

          </button>

          <div>

            <h1 className="text-3xl font-bold">

              Kết quả phiên mô phỏng

            </h1>

            <p className="text-[#A39684] mt-1">

              Phân tích hiệu suất và đánh giá AI.

            </p>

          </div>

        </div>

        <Trophy
          size={34}
          className="text-[#D9C3A3]"
        />

      </div>

    </div>

  );

};

export default Header;