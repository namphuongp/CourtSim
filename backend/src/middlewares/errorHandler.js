import { publicErrorMessage } from '../../../shared/userCopy.mjs';

export function notFoundHandler(request, response) {
  response.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Không tìm thấy nội dung này. Vui lòng tải lại trang.' },
  });
}

export function errorHandler(error, _request, response, _next) {
  let status = error.statusCode ?? 500;
  let code = error.code ?? 'INTERNAL_ERROR';
  let message = error.message;
  const isOperationalError = error.name === 'AppError';

  if (error.name === 'ValidationError' || error.name === 'CastError') {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'Dữ liệu không hợp lệ.';
  } else if (error.code === 11000) {
    status = 409;
    code = 'DUPLICATE_RESOURCE';
    message = 'Dữ liệu đã tồn tại.';
  } else if (error.type === 'entity.parse.failed') {
    status = 400;
    code = 'INVALID_JSON';
    message = 'Nội dung gửi lên không hợp lệ.';
  } else if (error.type === 'entity.too.large') {
    status = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'Nội dung gửi lên quá lớn.';
  } else if (status >= 500) {
    console.error('Request failed:', { code: isOperationalError ? code : 'INTERNAL_ERROR', name: error.name,
      method: _request.method, route: _request.route?.path,
      ...(process.env.NODE_ENV !== 'production' && !isOperationalError ? { frames: error.stack?.split('\n').slice(1, 5).join('\n') } : {}) });
    // Chỉ ẩn chi tiết lỗi lập trình; AppError chứa thông báo an toàn cho người dùng.
    if (!isOperationalError) message = 'Đã xảy ra lỗi máy chủ.';
  }

  response.status(status).json({ error: { code, message: publicErrorMessage(message, code, status) } });
}
