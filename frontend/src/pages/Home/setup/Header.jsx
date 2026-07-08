import React from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Header = () => {
  const navigate = useNavigate();

  return (
    <div className="border-b border-white/10 bg-[#221D18]">
      <div className="max-w-7xl mx-auto flex items-center gap-4 px-8 py-5">

        <button
          onClick={() => navigate("/dashboard")}
          className="p-2 rounded-xl bg-[#2A241E] hover:bg-[#3A322C]"
        >
          <ArrowLeft size={20}/>
        </button>

        <div>

          <h1 className="text-3xl font-bold">

            Thiết lập phiên mô phỏng

          </h1>

          <p className="text-[#A39684] mt-1">

            Chọn thông tin trước khi bắt đầu phiên tòa.

          </p>

        </div>

      </div>
    </div>
  );
};

export default Header;