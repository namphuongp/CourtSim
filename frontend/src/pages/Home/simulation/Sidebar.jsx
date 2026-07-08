import React from "react";
import { Scale } from "lucide-react";
import ProgressBar from "./ProgressBar";

const Sidebar = ({
  selectedRole,
  difficulty,
  selectedModels,
  progress,
  openDocument,
}) => {
  return (
    <div className="space-y-8">

      <div className="rounded-2xl bg-[#241F1A] border border-white/10 p-6">

        <div className="flex items-center gap-3 mb-5">

          <Scale className="text-[#D9C3A3]" />

          <h2 className="text-xl font-bold">

            Thông tin

          </h2>

        </div>

        <div className="space-y-4">

          <p>

            <span className="text-[#A39684]">

              Vai trò:

            </span>{" "}

            {selectedRole}

          </p>

          <p>

            <span className="text-[#A39684]">

              Độ khó:

            </span>{" "}

            {difficulty}

          </p>

          <p>

            <span className="text-[#A39684]">

              AI Models:

            </span>{" "}

            {selectedModels?.join(", ")}

          </p>

        </div>

      </div>

      <ProgressBar progress={progress} />

      <div className="rounded-2xl bg-[#241F1A] border border-white/10 p-6">

        <h2 className="text-xl font-bold mb-5">

          Hồ sơ PDF

        </h2>

        <button
          onClick={openDocument}
          className="w-full bg-[#D9C3A3] text-black py-3 rounded-xl font-bold hover:brightness-110"
        >

          Xem tài liệu

        </button>

      </div>

    </div>
  );
};

export default Sidebar;