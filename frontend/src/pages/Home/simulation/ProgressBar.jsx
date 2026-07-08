import React from "react";

const ProgressBar = ({ progress }) => {
  return (
    <div className="rounded-2xl bg-[#241F1A] border border-white/10 p-6">

      <h2 className="text-xl font-bold mb-5">

        Tiến trình mô phỏng

      </h2>

      <div className="w-full h-4 bg-[#1A1612] rounded-full overflow-hidden">

        <div
          className="bg-[#D9C3A3] h-4 transition-all duration-700"
          style={{
            width: `${progress}%`,
          }}
        />

      </div>

      <p className="text-[#A39684] mt-4">

        {progress}% hoàn thành

      </p>

    </div>
  );
};

export default ProgressBar;