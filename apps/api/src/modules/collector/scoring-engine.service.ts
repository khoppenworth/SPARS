type EvalResponse = {
  questionCode: string;
  answerJson: any | null;
  isNa: boolean;
  isHidden: boolean;
  scoringJson: any | null;
};

export class ScoringEngineService {
  compute(
    responses: EvalResponse[],
    calculatedFields: { code: string; outputType: string; formulaJson: any }[],
    indicators: { code: string; indicatorType: string; definitionJson: any }[],
  ) {
    const calcResults = new Map<string, number>();

    for (const cf of calculatedFields) {
      const formula = cf.formulaJson || {};
      let value = 0;

      if (formula.op === 'percentFromQuestions' && Array.isArray(formula.questionCodes)) {
        const eligible = responses.filter(r =>
          formula.questionCodes.includes(r.questionCode) && !r.isNa && !r.isHidden
        );
        const numerator = eligible.reduce((sum, r) => {
          const map = (r.scoringJson && r.scoringJson.map) || {};
          const raw = r.answerJson?.value;
          const mapped = map[String(raw)];
          return sum + (typeof mapped === 'number' ? mapped : 0);
        }, 0);
        const denominator = eligible.reduce((sum, r) => {
          const weight = Number((r.scoringJson && r.scoringJson.weight) || 1);
          return sum + weight;
        }, 0);
        value = denominator > 0 ? (numerator / denominator) * 100 : 0;
      }

      if (formula.op === 'averageCalculatedFields' && Array.isArray(formula.calculatedFieldCodes)) {
        const vals = formula.calculatedFieldCodes
          .map((code: string) => calcResults.get(code))
          .filter((v: any) => typeof v === 'number');
        value = vals.length ? vals.reduce((a: number, b: number) => a + b, 0) / vals.length : 0;
      }

      calcResults.set(cf.code, value);
    }

    const visitScores = indicators.map(ind => {
      const def = ind.definitionJson || {};
      let valuePercent = 0;
      if (def.valueFrom && calcResults.has(def.valueFrom)) {
        valuePercent = calcResults.get(def.valueFrom) || 0;
      }
      return {
        indicatorCode: ind.code,
        valuePercent,
        valueScore: valuePercent,
        detailsJson: { source: def.valueFrom || null },
      };
    });

    return { calcResults, visitScores };
  }
}
