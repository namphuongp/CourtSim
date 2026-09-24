export function notFoundHandler(request, response) {
  response.status(404).json({
    error: { code: 'NOT_FOUND', message: `Không tìm thấy ${request.method} ${request.originalUrl}.` },
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
  } else if (status >= 500) {
    console.error(error);
    // Chỉ ẩn chi tiết lỗi lập trình; AppError chứa thông báo an toàn cho người dùng.
    if (!isOperationalError) message = 'Đã xảy ra lỗi máy chủ.';
  }

  response.status(status).json({ error: { code, message, ...(error.details ? { details: error.details } : {}) } });
}
