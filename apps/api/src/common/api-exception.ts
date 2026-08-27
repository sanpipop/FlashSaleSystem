import { HttpException } from '@nestjs/common';

export class ApiException extends HttpException {
  constructor(status: number, code: string, message: string) {
    super({ status: 'error', code, message }, status);
  }
}
