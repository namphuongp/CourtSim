// Đường dẫn: src/data/mockData.js

export const currentUser = {
    name: "Luật sư Nguyễn Văn A",
    email: "nva.law@gmail.com",
    role: "Luật sư",
    avatar: "NA"
};

export const userStats = {
    totalCases: 2,
    skillScore: 8.5,
    practiceHours: "5h 30m",
    winRate: "68%"
};

// Danh sách toàn bộ vụ án giả lập
export const casesData = [
    {
        id: 'CS-1045',
        name: 'Tranh chấp hợp đồng lao động công ty X',
        role: 'Luật sư bảo vệ NLĐ',
        judge: 'Chủ tọa',
        date: '10/07/2026',
        status: 'Đang xử',
        score: null,
        progress: 45 // Phần trăm tiến độ
    },
    {
        id: 'CS-1044',
        name: 'Vụ án ly hôn và giành quyền nuôi con',
        role: 'Luật sư Bị đơn',
        judge: 'Chủ tọa',
        date: '08/07/2026',
        status: 'Hoàn thành',
        scores: {
            legalKnowledge: 90, // Kiến thức pháp lý
            logic: 85,          // Lập luận & Logic
            situational: 80,    // Xử lý tình huống
            defensive: 88       // Khả năng đối kháng
        },
        progress: 100
    },
    {
        id: 'CS-1043',
        name: 'Vi phạm bản quyền phần mềm thiết kế',
        role: 'Luật sư Nguyên đơn',
        judge: 'Chủ tọa',
        date: '05/07/2026',
        status: 'Hoàn thành',
        scores: {
            legalKnowledge: 85,
            logic: 78,
            situational: 70,
            defensive: 82
        },
        progress: 100
    },
    {
        id: 'CS-1042',
        name: 'Tranh chấp tài sản thừa kế gia đình họ Trần',
        role: 'Luật sư Nguyên đơn',
        judge: 'Chủ tọa',
        date: '01/07/2026',
        status: 'Đã hủy',
        score: null,
        progress: 0
    },


];
