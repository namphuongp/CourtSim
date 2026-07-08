import React from "react";

const RoleSelector = ({
  roles,
  selectedRole,
  setSelectedRole,
}) => {
  return (
    <div className="mt-14">

      <h2 className="text-2xl font-bold mb-6">

        Chọn vai trò

      </h2>

      <div className="grid md:grid-cols-2 gap-5">

        {roles.map((role) => {

          const Icon = role.icon;

          return (

            <div
              key={role.id}
              onClick={() => setSelectedRole(role.id)}
              className={`cursor-pointer rounded-2xl border p-6 flex items-center gap-5 transition

              ${
                selectedRole === role.id
                  ? "border-[#D9C3A3] bg-[#2A241E]"
                  : "border-white/10 bg-[#201B17] hover:border-[#D9C3A3]"
              }

              `}
            >

              <div className="p-4 rounded-xl bg-[#312B24]">

                <Icon
                  size={28}
                  className="text-[#D9C3A3]"
                />

              </div>

              <div>

                <h3 className="font-bold text-lg">

                  {role.title}

                </h3>

                <p className="text-[#A39684] mt-2 text-sm">

                  {role.id === "judge" &&
                    "Điều hành phiên tòa và đưa ra phán quyết."}

                  {role.id === "lawyer" &&
                    "Bảo vệ quyền lợi của thân chủ."}

                  {role.id === "prosecutor" &&
                    "Đưa ra lập luận buộc tội."}

                  {role.id === "defendant" &&
                    "Trình bày lời khai và phản biện."}

                </p>

              </div>

            </div>

          );

        })}

      </div>

    </div>
  );
};

export default RoleSelector;