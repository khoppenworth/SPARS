import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('/api/v1')
export class AppController {
  @Get('/health')
  health() {
    return { ok: true, time: new Date().toISOString() };
  }
}
