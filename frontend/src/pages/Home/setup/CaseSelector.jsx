import React from "react";

const CaseSelector = ({ cases, selectedCase, setSelectedCase }) => {

  return (

    <div>

      <h2 className="text-2xl font-bold mb-6">

        Chọn vụ án

      </h2>

      <div className="grid md:grid-cols-2 gap-6">

        {cases.map((item)=>(

          <div

            key={item.id}

            onClick={()=>setSelectedCase(item)}

            className={`cursor-pointer rounded-2xl border p-6 transition

            ${selectedCase?.id===item.id

              ? "border-[#D9C3A3] bg-[#2A241E]"

              :"border-white/10 bg-[#201B17] hover:border-[#D9C3A3]"
            }

            `}

          >

            <h3 className="text-xl font-bold">

              {item.title}

            </h3>

            <p className="mt-3 text-[#A39684] leading-7">

              {item.description}

            </p>

          </div>

        ))}

      </div>

    </div>

  );

};

export default CaseSelector;