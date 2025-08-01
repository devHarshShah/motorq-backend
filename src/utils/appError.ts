export class AppError extends Error {
  public status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;

    // Set the prototype explicitly (important for Error subclassing to work correctly)
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
