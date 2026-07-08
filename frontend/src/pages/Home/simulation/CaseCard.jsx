import React from "react";
import { FileText } from "lucide-react";

const CaseCard = ({ selectedCase }) => {

  return (

    <div className="rounded-2xl bg-[#241F1A] border border-white/10 p-6">

      <div className="flex items-center gap-3 mb-5">

        <FileText className="text-[#D9C3A3]" />

        <h2 className="text-2xl font-bold">

          Hồ sơ vụ án

        </h2>

      </div>

      <h3 className="text-xl font-bold">

        {selectedCase?.title}

      </h3>

      <p className="text-[#A39684] mt-4 leading-7">

        {selectedCase?.description}

      </p>

    </div>

  );

};

export default CaseCard;