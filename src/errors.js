export class AppError extends Error {
  constructor(message, status = 500, code = "INTERNAL_ERROR", options = {}) {
    super(message, options);
    this.name = "AppError";
    this.status = status;
    this.code = code;
  }
}

export function publicError(error) {
  if (error instanceof AppError) {
    return { status: error.status, body: { error: error.message, code: error.code } };
  }

  return {
    status: 500,
    body: {
      error: "The meeting could not be processed. Please try again.",
      code: "INTERNAL_ERROR",
    },
  };
}
