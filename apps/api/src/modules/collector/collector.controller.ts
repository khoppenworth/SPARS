import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CollectorService } from './collector.service';
import { CreateVisitDto } from './dto/create-visit.dto';
import { UpsertResponseDto } from './dto/upsert-response.dto';
import { BatchUpsertResponsesDto } from './dto/batch-upsert-responses.dto';

@ApiTags('collector')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('/api/v1/collector')
export class CollectorController {
  constructor(private readonly collector: CollectorService) {}

  @Post('/visits')
  createVisit(@Req() req: any, @Body() dto: CreateVisitDto) {
    return this.collector.createVisit(req.user.userId, dto);
  }

  @Post('/visits/:visitId/responses')
  upsertResponse(@Req() req: any, @Param('visitId') visitId: string, @Body() dto: UpsertResponseDto) {
    return this.collector.upsertResponse(req.user.userId, BigInt(visitId), dto);
  }

  @Post('/visits/:visitId/submit')
  submit(@Req() req: any, @Param('visitId') visitId: string) {
    return this.collector.submit(req.user.userId, BigInt(visitId));
  }

  @Post('/visits/:visitId/responses/batch')
  batchResponses(@Req() req: any, @Param('visitId') visitId: string, @Body() dto: BatchUpsertResponsesDto) {
    return this.collector.batchUpsertResponses(req.user.userId, BigInt(visitId), dto);
  }

}
