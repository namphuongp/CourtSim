import React from "react";

const DocumentModal = ({ open, onClose, selectedCase }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">

      <div className="bg-[#241F1A] w-[800px] max-w-[95%] rounded-3xl p-8 border border-white/10">

        <h2 className="text-3xl font-bold">

          Hồ sơ vụ án

        </h2>

        <div className="mt-8 space-y-5">

          <div>

            <h3 className="font-bold text-[#D9C3A3]">

              Tên vụ án

            </h3>

            <p className="mt-2">

              {selectedCase?.title}

            </p>

          </div>

          <div>

            <h3 className="font-bold text-[#D9C3A3]">

              Mô tả

            </h3>

            <p className="mt-2 leading-8 text-[#E6D9C6]">

              {selectedCase?.description}

            </p>

          </div>

          <div>

            <h3 className="font-bold text-[#D9C3A3]">

              Hồ sơ PDF

            </h3>

            <p className="mt-2 text-[#A39684]">

              Sau này backend sẽ tải file PDF của vụ án tại đây.

            </p>

          </div>

        </div>

        <div className="flex justify-end mt-10">

          <button
            onClick={onClose}
            className="bg-[#D9C3A3] text-black px-7 py-3 rounded-xl font-bold hover:brightness-110"
          >

            Đóng

          </button>

        </div>

      </div>

    </div>
  );
};

export default DocumentModal;