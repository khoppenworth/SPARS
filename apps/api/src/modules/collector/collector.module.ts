import { Module } from '@nestjs/common';
import { CollectorController } from './collector.controller';
import { CollectorService } from './collector.service';
import { RuleEngineService } from './rule-engine.service';
import { ScoringEngineService } from './scoring-engine.service';
@Module({ controllers: [CollectorController], providers: [CollectorService, RuleEngineService, ScoringEngineService] })
export class CollectorModule {}
