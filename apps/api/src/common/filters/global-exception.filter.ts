import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from "@nestjs/common";
import { DomainError } from "../errors/domain-error";

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(err: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    let status = 500,
      code = "INTERNAL",
      message = "Something went wrong";
    let details: Record<string, unknown> | undefined;
    if (err instanceof DomainError) {
      ({ httpStatus: status, code, message } = err);
      details = err.details;
    } else if (err instanceof HttpException) {
      status = err.getStatus();
      code = status === 404 ? "NOT_FOUND" : "HTTP_ERROR";
      message = err.message;
    }
    res
      .status(status)
      .json({ success: false, data: null, meta: null, error: { code, message, ...(details ? { details } : {}) } });
  }
}
