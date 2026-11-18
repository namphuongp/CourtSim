import StepGuide from '../StepGuide';

function guideSteps(completed, concluded, maxTurns) {
  let closingStep = {
    target: '.room-header-end',
    title: 'Kết thúc phiên tòa',
    text: 'Sau khi gửi ít nhất một lượt lập luận, bấm Kết thúc phiên tòa ở đầu màn hình rồi xác nhận để nhận đánh giá.',
  };
  if (completed) {
    closingStep = {
      target: '.room-turn-action',
      title: 'Xem kết quả',
      text: 'Bấm Xem kết quả để đọc điểm và nhận xét. Bạn có thể xem lại biên bản để đối chiếu với nhận xét.',
    };
  } else if (concluded) {
    closingStep = {
      target: '.room-turn-action',
      title: 'Nghị án và chấm điểm',
      text: 'Chủ tọa đã khép lại phần tranh luận. Chọn Nghị án và chấm điểm để mở kết quả ngay.',
    };
  }
  return [
    { target: '.deck-evidence-btn', title: 'Xem hồ sơ vụ án', text: 'Bấm Hồ sơ chứng cứ để xem tài liệu. Chọn Tổng quan để đọc diễn biến, hoặc Các bên & yêu cầu để xem quan điểm của từng phía.' + (completed ? ' Phiên đã kết thúc chỉ cho phép xem lại.' : ' Khi đến lượt bạn, có thể đưa chứng cứ vào ô lập luận rồi bổ sung phần phân tích của mình.') },
    { target: '.court-speech', title: 'Đọc và xem lại lời thoại', text: 'Cuộn trong khung hội thoại để đọc các lượt đã lưu. Chọn nút Phóng to lời thoại để xem toàn văn và căn cứ nếu có.' },
    ...(!completed ? [
      { target: '.room-turn-action', title: 'Tiếp tục đúng lượt', text: 'Đọc xong, bấm Tiếp tục để nghe lượt kế tiếp, hoặc Trình bày ý kiến khi được mời phát biểu. Nếu đang xem lời cũ, chọn Trở về lượt hiện tại. Khi báo lỗi, bấm Thử lại lời thoại.' },
      { target: '.courtroom-composer-form', title: 'Gửi lập luận', text: `Nêu yêu cầu, liên hệ chứng cứ và trả lời ý kiến vừa được đưa ra, rồi bấm Gửi lập luận trên thanh điều khiển. Mỗi lần nhập tối đa 4.000 ký tự, phiên có tối đa ${maxTurns} lượt của người học. Chưa gửi thì nội dung vẫn là bản nháp.` },
    ] : []),
    { target: '.room-tools-trigger', title: 'Tra cứu và sử dụng luật', text: 'Trong Công cụ khác, chọn Trợ lý luật, nhập vấn đề hoặc số hiệu, điều khoản rồi bấm Hỏi trợ lý. Đọc trích đoạn, mở nguồn và kiểm tra trạng thái áp dụng theo thời điểm.' + (completed ? ' Phiên này không thể gửi thêm lập luận.' : ' Khi đến lượt bạn, chọn Đưa trích dẫn vào lập luận, nội dung chỉ được gửi khi bạn bấm Gửi lập luận.') },
    { target: '.deck-transcript-btn', title: 'Xem biên bản', text: 'Bấm Biên bản trên thanh điều khiển để xem các lời trao đổi đã lưu. Chọn một lời để xem lại tại phòng xử án.' },
    closingStep,
  ];
}

export default function CourtroomGuide({ onClose, onDismissPermanently, returnFocusRef, completed = false, concluded = false, hasDialogue = true, maxTurns = 20 }) {
  const steps = guideSteps(completed, concluded, maxTurns).filter(item => hasDialogue || item.target !== '.court-speech');
  return (
    <StepGuide
      steps={steps}
      reopenNote="Bạn luôn có thể mở lại từ Công cụ khác → Hướng dẫn."
      returnFocusRef={returnFocusRef}
      onClose={onClose}
      onFinish={onDismissPermanently}
      onSkip={onDismissPermanently}
    />
  );
}
