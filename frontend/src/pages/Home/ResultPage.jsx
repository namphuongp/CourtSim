import React from "react";
import { useLocation } from "react-router-dom";

import Header from "./result/Header";
import ScoreCard from "./result/ScoreCard";
import AIAnalysis from "./result/AIAnalysis";
import ImprovementCard from "./result/ImprovementCard";
import Statistics from "./result/Statistics";
import TranscriptCard from "./result/TranscriptCard";
import RatingCard from "./result/RatingCard";
import ActionButtons from "./result/ActionButtons";

const ResultPage = () => {

  const location = useLocation();

  const {

    selectedCase,

    selectedRole,

    difficulty,

    selectedModels = [],

    transcript = [],

    debates = [],

    time = "30:00",

    score = 8.6,

  } = location.state || {};

  return (

    <div className="min-h-screen bg-[#1A1612] text-[#F2E7D5]">

      <Header />

      <div className="max-w-7xl mx-auto p-8">

        <div className="grid lg:grid-cols-3 gap-8">

          {/* LEFT */}

          <div className="lg:col-span-2 space-y-8">

            <ScoreCard
              score={score}
            />

            <AIAnalysis
              selectedModels={selectedModels}
            />

            <ImprovementCard />

            <TranscriptCard
              transcript={transcript}
            />

          </div>

          {/* RIGHT */}

          <div className="space-y-8">

            <Statistics
              time={time}
              transcriptCount={transcript.length}
              debateCount={debates.length}
              selectedModels={selectedModels}
            />

            <RatingCard />

            <ActionButtons />

          </div>

        </div>

      </div>

    </div>

  );

};

export default ResultPage;