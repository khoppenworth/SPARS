export type ResponseState = {
  questionCode: string;
  answerJson: any | null;
  isNa: boolean;
  naReason: string | null;
  isHidden: boolean;
  isRequired: boolean;
  sectionCode?: string | null;
};

function getRefValue(ref: any, state: ResponseState[]): any {
  if (ref && typeof ref === 'object' && ref.q) {
    const found = state.find(s => s.questionCode === ref.q);
    return found?.answerJson?.value ?? null;
  }
  return ref;
}

function evalExpr(expr: any, state: ResponseState[]): boolean {
  if (!expr || typeof expr !== 'object' || !expr.op) return false;

  switch (expr.op) {
    case 'eq':
      return getRefValue(expr.left, state) === getRefValue(expr.right, state);
    case 'ne':
      return getRefValue(expr.left, state) !== getRefValue(expr.right, state);
    case 'and':
      return Array.isArray(expr.args) && expr.args.every((e: any) => evalExpr(e, state));
    case 'or':
      return Array.isArray(expr.args) && expr.args.some((e: any) => evalExpr(e, state));
    case 'not':
      return !evalExpr(expr.arg, state);
    default:
      return false;
  }
}

export class RuleEngineService {
  applyRules(
    rules: { triggerExprJson: any; actionsJson: any }[],
    state: ResponseState[],
  ): ResponseState[] {
    const next = state.map(s => ({ ...s }));

    for (const rule of rules) {
      const applies = evalExpr(rule.triggerExprJson, next);
      if (!applies) continue;

      const actions = Array.isArray(rule.actionsJson) ? rule.actionsJson : [];
      for (const action of actions) {
        if (action.action === 'setNA') {
          for (const s of next) {
            if ((action.target?.questionCode && s.questionCode === action.target.questionCode) ||
                (action.target?.sectionCode && s.sectionCode === action.target.sectionCode)) {
              s.isNa = action.value !== false;
            }
          }
        }
        if (action.action === 'hide') {
          for (const s of next) {
            if ((action.target?.questionCode && s.questionCode === action.target.questionCode) ||
                (action.target?.sectionCode && s.sectionCode === action.target.sectionCode)) {
              s.isHidden = true;
            }
          }
        }
        if (action.action === 'require' && action.target?.questionCode) {
          const found = next.find(s => s.questionCode === action.target.questionCode);
          if (found) found.isRequired = true;
        }
      }
    }

    return next;
  }
}
