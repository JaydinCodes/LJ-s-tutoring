import { createClient } from 'npm:@supabase/supabase-js@2';
import { evaluateLearningResponse } from '../../../src/features/learning/learningResponseEvaluator.ts';
import { evaluateSkillMastery, generateRecommendations } from '../../../src/features/learning/learningDecisionEngine.ts';

const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type'};
const respond=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
const supportedTypes = new Set(['numeric', 'fraction', 'multiple_choice', 'coordinate', 'linear_equation_solution', 'algebraic_expression', 'factorised_expression']);
function inferQuestionType(answerConfig: unknown): string {
 const config = answerConfig && typeof answerConfig === 'object' && !Array.isArray(answerConfig) ? answerConfig as Record<string, unknown> : {};
 if (typeof config.type === 'string' && supportedTypes.has(config.type)) return config.type;
 if (typeof config.correct_option === 'string') return 'multiple_choice';
 const candidates = Array.isArray(config.accepted) ? config.accepted : Array.isArray(config.accepted_answers) ? config.accepted_answers : config.expected === undefined ? [] : [config.expected];
 const sample = String(candidates[0] ?? '').replace(/\s/g, '');
 if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(sample)) return 'numeric';
 if (/^[+-]?\d+\/[+-]?\d+$/.test(sample)) return 'fraction';
 if (/^\(?[+-]?\d+(?:\.\d+)?[,;][+-]?\d+(?:\.\d+)?\)?$/.test(sample)) return 'coordinate';
 if (/^[A-Za-z]=[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(sample)) return 'linear_equation_solution';
 if (/\([^()]*(?:\+|-)\d+[^()]*\).*\([^()]*(?:\+|-)\d+[^()]*\)/.test(sample)) return 'factorised_expression';
 if (/[A-Za-z]/.test(sample)) return 'algebraic_expression';
 return 'unsupported';
}
function rules(c:any){const p=(s:string,k:string)=>c[s][k]??c[s][k.replace(/[A-Z]/g,(v)=>`_${v.toLowerCase()}`)];return{emerging:{minimumIndependentAttempts:+p('emerging','minimumIndependentAttempts'),maximumIndependentAccuracy:+p('emerging','maximumIndependentAccuracy')},developing:{minimumIndependentAttempts:+p('developing','minimumIndependentAttempts'),minimumIndependentAccuracy:+p('developing','minimumIndependentAccuracy')},secure:{minimumIndependentAttempts:+p('secure','minimumIndependentAttempts'),minimumIndependentAccuracy:+p('secure','minimumIndependentAccuracy'),minimumDistinctOccasions:+p('secure','minimumDistinctOccasions'),requiresTargetLevelEvidence:!!p('secure','requiresTargetLevelEvidence'),blocksOnUnresolvedCriticalMisconception:!!p('secure','blocksOnUnresolvedCriticalMisconception')},retained:{requiresPriorSecure:!!p('retained','requiresPriorSecure'),minimumDelayedDays:+p('retained','minimumDelayedDays'),minimumIndependentAccuracy:+p('retained','minimumIndependentAccuracy')}}}

async function recalculate(admin:any,studentId:string){
 const {data:masteryRule}=await admin.from('mastery_rule_sets').select('id,configuration').eq('is_active',true).single(); const {data:recommendationRule}=await admin.from('recommendation_rule_sets').select('id').eq('is_active',true).single();
 const {data:rows}=await admin.from('learning_attempt_skill_evidence').select('id,skill_id,independence,is_target_skill,cognitive_level,correct,learning_attempts!inner(occurred_at)').eq('learning_attempts.student_id',studentId); if(!masteryRule||!recommendationRule||!rows)return;
 for(const skillId of [...new Set(rows.map((r:any)=>r.skill_id))] as string[]){
  const evidence=rows.filter((r:any)=>r.skill_id===skillId).map((r:any)=>({id:r.id,occurredAt:r.learning_attempts.occurred_at,independent:r.independence==='independent',isTargetSkill:r.is_target_skill,cognitiveLevel:r.cognitive_level,correct:r.correct}));
  const {data:tax}=await admin.from('misconceptions').select('id,code').eq('skill_id',skillId); const ids=(tax||[]).map((x:any)=>x.id); const {data:signals}=ids.length?await admin.from('learner_misconceptions').select('misconception_id,state,determined_at').eq('student_id',studentId).in('misconception_id',ids).order('determined_at',{ascending:false}):{data:[]}; const latest=new Map<string,any>(); for(const s of signals||[])if(!latest.has(s.misconception_id))latest.set(s.misconception_id,s);
  const misconceptions=(tax||[]).flatMap((x:any)=>{const s=latest.get(x.id)?.state;return s&&s!=='resolved'?[{code:x.code,state:s,evidenceCount:1,critical:true}]:[]});
  const {data:priorSecureRows}=await admin.from('skill_mastery_evaluations').select('determined_at').eq('student_id',studentId).eq('skill_id',skillId).eq('state','secure').order('determined_at',{ascending:false}).limit(1);
  const priorSecureAt=priorSecureRows?.[0]?.determined_at??null;
  const mastery=evaluateSkillMastery(evidence,rules(masteryRule.configuration),{misconceptions,priorSecureAt});
  const {data:links}=await admin.from('skill_prerequisites').select('prerequisite_skill_id,curriculum_skills!skill_prerequisites_prerequisite_skill_id_fkey(skill_code)').eq('skill_id',skillId); const pids=(links||[]).map((x:any)=>x.prerequisite_skill_id); const {data:states}=pids.length?await admin.from('skill_mastery_evaluations').select('skill_id,state,determined_at').eq('student_id',studentId).in('skill_id',pids).order('determined_at',{ascending:false}):{data:[]}; const stateMap=new Map<string,string>();for(const s of states||[])if(!stateMap.has(s.skill_id))stateMap.set(s.skill_id,s.state); const prerequisites=(links||[]).map((x:any)=>({code:x.curriculum_skills.skill_code,state:stateMap.get(x.prerequisite_skill_id)||'unassessed'}));
  const {data:retentionRows}=await admin.from('learning_retention_checks').select('status,outcome').eq('student_id',studentId).eq('skill_id',skillId);
  const failedDelayedRetrieval=(retentionRows||[]).some((row:any)=>row.outcome==='failed');
  const delayedRetrievalAvailable=(retentionRows||[]).some((row:any)=>row.status!=='superseded');
  const recommendation=generateRecommendations({mastery,evidence,prerequisites,misconceptions,complexAccuracyThreshold:.6,hintDependencyThreshold:.5,failedDelayedRetrieval,delayedRetrievalAvailable});
  let recommendationSkillId:string|null=null;
  if(recommendation?.focusSkillCode){const {data:focus}=await admin.from('curriculum_skills').select('id').eq('skill_code',recommendation.focusSkillCode).maybeSingle();recommendationSkillId=focus?.id??null;}
  const {error}=await admin.rpc('persist_automatic_learning_decision',{p_student_id:studentId,p_skill_id:skillId,p_mastery_rule_set_id:masteryRule.id,p_state:mastery.state,p_reason:mastery.reason,p_reason_codes:mastery.reasonCodes,p_evidence_ids:mastery.supportingEvidenceIds,p_fingerprint:[...mastery.supportingEvidenceIds].sort().join(':'),p_recommendation_rule_set_id:recommendation?recommendationRule.id:null,p_recommendation_type:recommendation?.recommendationType??null,p_recommended_sequence:recommendation?.sequence??[],p_recommendation_reason:recommendation?.reason??null,p_recommendation_reason_codes:recommendation?.reasonCodes??[],p_recommendation_skill_id:recommendationSkillId});if(error)throw error;
 }
}

Deno.serve(async(request)=>{if(request.method==='OPTIONS')return new Response('ok',{headers:cors});const bearer=request.headers.get('authorization'),url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(!bearer||!url||!anon||!service)return respond({error:'unauthorized'},401);const caller=createClient(url,anon,{global:{headers:{Authorization:bearer}},auth:{persistSession:false}});const {data:auth}=await caller.auth.getUser();if(!auth.user)return respond({error:'unauthorized'},401);const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}}),body=await request.json();
 if(body.p_complete_retention===true){const {data:outcome,error}=await caller.rpc('complete_my_learning_retention_check',{p_retention_check_id:body.p_retention_check_id,p_activity_code:body.p_activity_code});if(error)return respond({error:error.message},400);const {data:check}=await admin.from('learning_retention_checks').select('student_id').eq('id',body.p_retention_check_id).single();if(check)await recalculate(admin,check.student_id);return respond({retention_outcome:outcome});}
 let attemptId:string;
 if(body.p_review_id){const {data,error}=await caller.rpc('review_learning_attempt',body);if(error)return respond({error:error.message},400);attemptId=data;}else{const rpc=body.p_activity_code?'submit_my_activity_attempt':'submit_my_learning_attempt';const {data,error}=await caller.rpc(rpc,body);if(error)return respond({error:error.message},400);attemptId=data?.[0]?.attempt_id;}
 const {data:attempt,error:attemptError}=await admin.from('learning_attempts').select('id,student_id,response,status,question_versions!inner(id,answer_config,marks)').eq('id',attemptId).single();if(attemptError||!attempt)return respond({error:'evaluation_unavailable'},500);
 if(!body.p_review_id&&attempt.status==='submitted'){const q=attempt.question_versions as any;const result=evaluateLearningResponse({questionVersionId:q.id,questionType:inferQuestionType(q.answer_config),answerConfig:q.answer_config,learnerResponse:attempt.response,marksAvailable:q.marks});if(result.status==='needs_review'){const {error}=await admin.rpc('queue_learning_attempt_review',{p_learning_attempt_id:attempt.id,p_explanation_code:result.explanationCode});if(error)return respond({error:'review_queue_unavailable'},500);}else{const {error}=await admin.rpc('apply_automatic_learning_evaluation',{p_learning_attempt_id:attempt.id,p_is_correct:result.status==='correct',p_marks_awarded:result.marksAwarded,p_misconception_codes:result.misconceptionMatches.map((m)=>m.code)});if(error)return respond({error:'evaluation_unavailable'},500);await recalculate(admin,attempt.student_id);}}
 if(body.p_review_id)await recalculate(admin,attempt.student_id);const {data:final}=await admin.from('learning_attempts').select('status').eq('id',attemptId).single();return respond({attempt_id:attemptId,attempt_status:final?.status||'submitted'});
});
