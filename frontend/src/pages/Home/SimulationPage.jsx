import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

import Header from "./simulation/Header";
import CaseCard from "./simulation/CaseCard";
import VoiceRecorder from "./simulation/VoiceRecorder";
import Transcript from "./simulation/Transcript";
import DebateBox from "./simulation/DebateBox";
import Sidebar from "./simulation/Sidebar";
import DocumentModal from "./simulation/DocumentModal";
import FinishButton from "./simulation/FinishButton";
const SimulationPage = () => {

  const location = useLocation();

  const {
    selectedCase,
    selectedRole,
    difficulty,
    selectedModels,
  } = location.state || {};

  const [voiceEnabled, setVoiceEnabled] = useState(false);

  const [documentOpen, setDocumentOpen] = useState(false);

  const [progress, setProgress] = useState(0);

  const [minutes, setMinutes] = useState(30);

  const [seconds, setSeconds] = useState(0);

  const [message, setMessage] = useState("");

  const [transcript, setTranscript] = useState([]);

  const [debates, setDebates] = useState([
    {
      speaker: "GPT-5",
      text: "Xin chào, phiên tòa mô phỏng đã bắt đầu.",
    },
  ]);

  useEffect(() => {

    const timer = setInterval(() => {

      setProgress((prev) => {

        if (prev >= 100) return 100;

        return prev + 1;

      });

    }, 6000);

    return () => clearInterval(timer);

  }, []);

  useEffect(() => {

    const countdown = setInterval(() => {

      if (seconds > 0) {

        setSeconds(seconds - 1);

      } else {

        if (minutes > 0) {

          setMinutes(minutes - 1);

          setSeconds(59);

        }

      }

    }, 1000);

    return () => clearInterval(countdown);

  }, [minutes, seconds]);

  return (

    <div className="min-h-screen bg-[#1A1612] text-[#F2E7D5]">

      <Header

        minutes={minutes}

        seconds={seconds}

      />

      <div className="max-w-7xl mx-auto p-8">

        <div className="grid lg:grid-cols-3 gap-8">

          {/* LEFT */}

          <div className="lg:col-span-2 space-y-8">

            <CaseCard

              selectedCase={selectedCase}

            />

            <VoiceRecorder

              voiceEnabled={voiceEnabled}

              setVoiceEnabled={setVoiceEnabled}

            />

            <Transcript

              transcript={transcript}

            />

            <DebateBox

              debates={debates}

              message={message}

              setMessage={setMessage}

              transcript={transcript}

              setTranscript={setTranscript}

              setDebates={setDebates}

            />

          </div>

          {/* RIGHT */}

          <div><Sidebar
  selectedRole={selectedRole}
  difficulty={difficulty}
  selectedModels={selectedModels}
  progress={progress}
  openDocument={() => setDocumentOpen(true)}
/>

<FinishButton
  selectedCase={selectedCase}
  selectedRole={selectedRole}
  difficulty={difficulty}
  selectedModels={selectedModels}
  transcript={transcript}
  debates={debates}
  time={`${minutes}:${seconds.toString().padStart(2, "0")}`}
/>

</div>

</div>

</div>

<DocumentModal
  open={documentOpen}
  onClose={() => setDocumentOpen(false)}
  selectedCase={selectedCase}
/>

</div>

);

};

export default SimulationPage;
          