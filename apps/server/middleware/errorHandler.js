export const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Multer file-upload errors (no statusCode by default) → 400
  if (err.name === 'MulterError') {
    statusCode = 400;
    if (err.code === 'LIMIT_FILE_SIZE') message = 'Image is too large (max 5MB).';
  }

  // Mongoose validation errors → 400
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors).map((e) => e.message).join('; ');
  }

  // A malformed ObjectId is a client mistake, not a server fault.
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }

  // Duplicate key on a unique index.
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue || {})[0];
    message = field ? `That ${field} is already in use.` : 'Duplicate value.';
  }

  // Hand the real reason to the blackbox before it is generalized away
  // for the client. The audit middleware reads this on response finish.
  res.locals.auditError = res.locals.auditError || `${err.name || 'Error'}: ${err.message}`;

  if (statusCode === 500) {
    console.error(`[errorHandler] 500 (req ${req.id}):`, err);
    // Internal failures must not leak stack details, driver messages or
    // file paths to the caller in production.
    if (process.env.NODE_ENV === 'production') {
      message = 'Something went wrong. Please try again.';
    }
  }

  res.status(statusCode).json({
    success: false,
    message,
    // The correlation id lets a user quote one string that pins the exact
    // entry in the audit log.
    requestId: req.id,
    ...(err.code && typeof err.code === 'string' ? { code: err.code } : {}),
    ...(err.extra ? { data: err.extra } : {}),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

export default errorHandler;
