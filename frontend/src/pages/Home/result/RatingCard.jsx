import React, { useState } from "react";
import { Star } from "lucide-react";

const RatingCard = () => {

  const [rating, setRating] = useState(0);

  const [hover, setHover] = useState(0);

  const [comment, setComment] = useState("");

  return (

    <div className="rounded-3xl bg-[#241F1A] border border-white/10 p-8">

      <h2 className="text-2xl font-bold mb-6">

        Đánh giá trải nghiệm

      </h2>

      <p className="text-[#A39684] mb-6">

        Hãy đánh giá chất lượng phiên mô phỏng để giúp CourtSim cải thiện.

      </p>

      <div className="flex gap-3 mb-8">

        {[1,2,3,4,5].map((star)=>(

          <Star

            key={star}

            size={36}

            onMouseEnter={()=>setHover(star)}

            onMouseLeave={()=>setHover(0)}

            onClick={()=>setRating(star)}

            className={`cursor-pointer transition

            ${(hover || rating) >= star

              ? "fill-yellow-400 text-yellow-400"

              : "text-gray-500"

            }

            `}

          />

        ))}

      </div>

      <textarea

        rows={5}

        value={comment}

        onChange={(e)=>setComment(e.target.value)}

        placeholder="Nhập nhận xét của bạn..."

        className="w-full rounded-xl bg-[#2A241E] border border-white/10 p-4 outline-none"

      />

      <button

        className="mt-6 bg-[#D9C3A3] text-black px-8 py-3 rounded-xl font-bold hover:brightness-110"

      >

        Gửi đánh giá

      </button>

    </div>

  );

};

export default RatingCard;