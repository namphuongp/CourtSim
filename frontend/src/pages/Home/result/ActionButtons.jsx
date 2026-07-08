import React from "react";
import {
  RotateCcw,
  Home,
  Download,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const ActionButtons = () => {

  const navigate = useNavigate();

  const exportPDF = () => {

    alert("Chức năng xuất PDF sẽ được tích hợp ở Backend.");

  };

  return (

    <div className="rounded-3xl bg-[#241F1A] border border-white/10 p-8">

      <h2 className="text-2xl font-bold mb-8">

        Tùy chọn

      </h2>

      <div className="grid md:grid-cols-3 gap-5">

        {/* Export */}

        <button

          onClick={exportPDF}

          className="bg-[#D9C3A3] text-black rounded-2xl py-5 font-bold hover:brightness-110 flex items-center justify-center gap-3"

        >

          <Download size={22} />

          Xuất PDF

        </button>

        {/* Retry */}

        <button

          onClick={() => navigate("/setup")}

          className="bg-[#2A241E] rounded-2xl py-5 hover:bg-[#332D27] flex items-center justify-center gap-3"

        >

          <RotateCcw size={22} />

          Mô phỏng lại

        </button>

        {/* Dashboard */}

        <button

          onClick={() => navigate("/dashboard")}

          className="bg-[#2A241E] rounded-2xl py-5 hover:bg-[#332D27] flex items-center justify-center gap-3"

        >

          <Home size={22} />

          Dashboard

        </button>

      </div>

    </div>

  );

};

export default ActionButtons;