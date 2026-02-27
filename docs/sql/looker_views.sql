USE spars;

CREATE OR REPLACE VIEW vw_visits AS
SELECT
  sv.id AS visit_id,
  sv.org_id,
  tv.tool_id,
  sv.tool_version_id,
  sv.facility_id,
  f.name AS facility_name,
  sv.collector_user_id,
  u.email AS collector_email,
  sv.visit_date,
  sv.status,
  sv.submitted_at,
  sv.created_at,
  sv.updated_at
FROM supervision_visits sv
JOIN facilities f ON f.id = sv.facility_id
JOIN users u ON u.id = sv.collector_user_id
JOIN tool_versions tv ON tv.id = sv.tool_version_id;

CREATE OR REPLACE VIEW vw_visit_scores AS
SELECT
  vs.visit_id,
  v.org_id,
  v.tool_id,
  v.tool_version_id,
  vs.indicator_code,
  vs.value_number,
  vs.value_percent,
  vs.value_score,
  JSON_EXTRACT(vs.details_json, '$.numerator') AS numerator,
  JSON_EXTRACT(vs.details_json, '$.denominator') AS denominator
FROM visit_scores vs
JOIN vw_visits v ON v.visit_id = vs.visit_id;

CREATE OR REPLACE VIEW vw_visit_answers_flat AS
SELECT
  vr.visit_id,
  v.org_id,
  v.tool_id,
  v.tool_version_id,
  q.code AS question_code,
  q.question_type,
  vr.is_na,
  vr.is_hidden,
  vr.na_reason,
  vr.answer_json,
  JSON_UNQUOTE(JSON_EXTRACT(vr.answer_json, '$.value')) AS answer_value_text,
  CAST(JSON_EXTRACT(vr.answer_json, '$.value') AS DECIMAL(18,6)) AS answer_value_number
FROM visit_responses vr
JOIN vw_visits v ON v.visit_id = vr.visit_id
JOIN questions q ON q.id = vr.question_id;

CREATE OR REPLACE VIEW vw_facility_indicator_trend AS
SELECT
  v.facility_id,
  v.facility_name,
  v.visit_date,
  s.indicator_code,
  s.value_percent,
  s.value_score
FROM vw_visits v
JOIN vw_visit_scores s ON s.visit_id = v.visit_id;
