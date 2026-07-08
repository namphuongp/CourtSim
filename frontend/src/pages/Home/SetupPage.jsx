import React, { useState } from "react";

import { Gavel, Shield, Scale, User } from "lucide-react";

import Header from "./setup/Header";
import CaseSelector from "./setup/CaseSelector";
import RoleSelector from "./setup/RoleSelector";
import AISelector from "./setup/AISelector";
import DifficultySelector from "./setup/DifficultySelector";
import VoiceCard from "./setup/VoiceCard";
import PlanSelector from "./setup/PlanSelector";
import SummaryCard from "./setup/SummaryCard";

const cases = [
  {
    id: 1,
    title: "Vụ án Bản quyền AI",
    description:
      "Tranh chấp quyền sở hữu dữ liệu dùng để huấn luyện mô hình AI.",
  },
  {
    id: 2,
    title: "Vụ án Lừa đảo trực tuyến",
    description:
      "Điều tra hành vi giả mạo website ngân hàng để chiếm đoạt tài sản.",
  },
  {
    id: 3,
    title: "Vụ án Trộm cắp tài sản",
    description:
      "Mô phỏng phiên tòa hình sự với các chứng cứ và lời khai.",
  },
  {
    id: 4,
    title: "Vụ án Ly hôn",
    description:
      "Giải quyết tranh chấp quyền nuôi con và phân chia tài sản.",
  },
];

const roles = [
  {
    id: "lawyer",
    title: "Luật sư bào chữa",
    icon: Shield,
  },
  {
    id: "prosecutor",
    title: "Kiểm sát viên",
    icon: Scale,
  },
  {
    id: "judge",
    title: "Thẩm phán",
    icon: Gavel,
  },
  {
    id: "defendant",
    title: "Bị cáo",
    icon: User,
  },
];

const aiModels = [
  "GPT-5",
  "Gemini 2.5",
  "Claude",
  "DeepSeek",
  "Qwen",
];

const SetupPage = () => {

  const [selectedCase, setSelectedCase] = useState(null);

  const [selectedRole, setSelectedRole] = useState(null);

  const [selectedModels, setSelectedModels] = useState(["GPT-5"]);

  const [difficulty, setDifficulty] = useState("Medium");

  const [voiceEnabled, setVoiceEnabled] = useState(false);

  const [plan, setPlan] = useState("Free");

  const toggleModel = (model) => {

    if (selectedModels.includes(model)) {

      setSelectedModels(
        selectedModels.filter((m) => m !== model)
      );

    } else {

      setSelectedModels([
        ...selectedModels,
        model,
      ]);

    }

  };

  return (

    <div className="min-h-screen bg-[#1A1612] text-[#F2E7D5]">

      <Header />

      <div className="max-w-7xl mx-auto p-8">

        <CaseSelector
          cases={cases}
          selectedCase={selectedCase}
          setSelectedCase={setSelectedCase}
        />

        <RoleSelector
          roles={roles}
          selectedRole={selectedRole}
          setSelectedRole={setSelectedRole}
        />

        <AISelector
          aiModels={aiModels}
          selectedModels={selectedModels}
          toggleModel={toggleModel}
        />

        <DifficultySelector
          difficulty={difficulty}
          setDifficulty={setDifficulty}
        />

        <VoiceCard
          voiceEnabled={voiceEnabled}
          setVoiceEnabled={setVoiceEnabled}
        />

        <PlanSelector
          plan={plan}
          setPlan={setPlan}
        />

        <SummaryCard
          selectedCase={selectedCase}
          selectedRole={selectedRole}
          selectedModels={selectedModels}
          difficulty={difficulty}
          voiceEnabled={voiceEnabled}
          plan={plan}
        />

      </div>

    </div>

  );

};

export default SetupPage;