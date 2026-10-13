const form=document.querySelector('#assessment-form');
const stages={A:{name:'At-risk pattern',desc:'Stable-pattern inputs in the synthetic training data.',color:'#62d9d3'},B:{name:'Beginning shock pattern',desc:'Instability-pattern inputs without clear synthetic hypoperfusion.',color:'#b6e36f'},C:{name:'Classic shock pattern',desc:'Hypoperfusion pattern in the synthetic training data.',color:'#ffab58'},D:{name:'Deteriorating pattern',desc:'Higher-severity pattern; clinical Stage D requires failed initial support.',color:'#ff6577'},E:{name:'Extremis pattern',desc:'Severe pattern; clinical Stage E requires collapse or equivalent context.',color:'#c58cff'}};
const presets={
 A:{map_mmhg:86,ci_l_min_m2:3.0,co_l_min:6.2,pad_mmhg:12,cvp_mmhg:6,lactate_mmol_l:1.1,svo2_pct:70,bnp_pg_ml:160,urine_output_ml_hr:85,urine_output_ml_kg_hr:1.0,capillary_refill_sec:1.5,gcs_eye:4,gcs_verbal:5,gcs_motor:6,gcs_total:15,weight_kg:82,bsa_m2:2.05,pulse:'normal_2plus',peripheral_color:'usual_for_patient',peripheral_temperature:'warm',neurological_assessment:'alert_oriented'},
 B:{map_mmhg:57,ci_l_min_m2:2.45,co_l_min:5.0,pad_mmhg:18,cvp_mmhg:10,lactate_mmol_l:1.5,svo2_pct:64,bnp_pg_ml:650,urine_output_ml_hr:62,urine_output_ml_kg_hr:.72,capillary_refill_sec:1.8,gcs_eye:4,gcs_verbal:5,gcs_motor:6,gcs_total:15,weight_kg:86,bsa_m2:2.04,pulse:'normal_2plus',peripheral_color:'usual_for_patient',peripheral_temperature:'warm',neurological_assessment:'alert_oriented'},
 C:{map_mmhg:64,ci_l_min_m2:1.95,co_l_min:4.0,pad_mmhg:23,cvp_mmhg:13,lactate_mmol_l:3.2,svo2_pct:54,bnp_pg_ml:1250,urine_output_ml_hr:27,urine_output_ml_kg_hr:.34,capillary_refill_sec:3.2,gcs_eye:4,gcs_verbal:4,gcs_motor:6,gcs_total:14,weight_kg:80,bsa_m2:2.04,pulse:'weak_1plus',peripheral_color:'pale',peripheral_temperature:'cool',neurological_assessment:'confused'},
 D:{map_mmhg:57,ci_l_min_m2:1.55,co_l_min:3.2,pad_mmhg:26,cvp_mmhg:17,lactate_mmol_l:5.5,svo2_pct:45,bnp_pg_ml:2600,urine_output_ml_hr:14,urine_output_ml_kg_hr:.17,capillary_refill_sec:4.8,gcs_eye:3,gcs_verbal:3,gcs_motor:5,gcs_total:11,weight_kg:82,bsa_m2:2.06,pulse:'doppler_only',peripheral_color:'mottled',peripheral_temperature:'cold',neurological_assessment:'lethargic'},
 E:{map_mmhg:43,ci_l_min_m2:1.0,co_l_min:2.1,pad_mmhg:28,cvp_mmhg:19,lactate_mmol_l:11,svo2_pct:34,bnp_pg_ml:4200,urine_output_ml_hr:3,urine_output_ml_kg_hr:.04,capillary_refill_sec:6.5,gcs_eye:1,gcs_verbal:1,gcs_motor:2,gcs_total:4,weight_kg:80,bsa_m2:2.02,pulse:'absent',peripheral_color:'cyanotic',peripheral_temperature:'cold',neurological_assessment:'unresponsive'}
};
let model;
function pretty(v){return v.replaceAll('_',' ').replace('2plus','2+').replace('doppler only','Doppler only').replace(/\b\w/g,c=>c.toUpperCase())}
fetch('model.json').then(r=>r.json()).then(m=>{model=m;setupSelects();loadPreset('C');predict();}).catch(()=>{document.querySelector('#stage-description').textContent='Model file could not be loaded.'});
function setupSelects(){for(const key of model.categorical_features){const el=form.elements[key];el.innerHTML=model.categorical_levels[key].map(v=>`<option value="${v}">${pretty(v)}</option>`).join('')}}
function loadPreset(stage){const p=presets[stage];for(const [k,v] of Object.entries(p)){if(k==='pulse'){for(const n of ['pulse_left_radial','pulse_right_radial','pulse_left_dorsalis_pedis','pulse_right_dorsalis_pedis'])form.elements[n].value=v}else if(form.elements[k])form.elements[k].value=v}}
function vary(value,fraction,digits=1){const varied=value*(1+(Math.random()*2-1)*fraction);return Number(varied.toFixed(digits))}
function generateTestPatient(){
  const stage='ABCDE'[Math.floor(Math.random()*5)],base={...presets[stage]};
  const patient={...base,weight_kg:vary(base.weight_kg,.18,1),bsa_m2:vary(base.bsa_m2,.09,3)};
  for(const key of ['map_mmhg','pad_mmhg','cvp_mmhg','svo2_pct','capillary_refill_sec'])patient[key]=vary(base[key],.12,1);
  patient.ci_l_min_m2=vary(base.ci_l_min_m2,.12,2);
  patient.co_l_min=Number((patient.ci_l_min_m2*patient.bsa_m2).toFixed(2));
  patient.lactate_mmol_l=vary(base.lactate_mmol_l,.18,2);
  patient.bnp_pg_ml=Math.round(vary(base.bnp_pg_ml,.35,0));
  patient.urine_output_ml_kg_hr=Math.max(0,vary(base.urine_output_ml_kg_hr,.25,3));
  patient.urine_output_ml_hr=Number((patient.urine_output_ml_kg_hr*patient.weight_kg).toFixed(1));
  for(const [k,v] of Object.entries(patient)){if(k==='pulse'){for(const n of ['pulse_left_radial','pulse_right_radial','pulse_left_dorsalis_pedis','pulse_right_dorsalis_pedis'])form.elements[n].value=v}else if(form.elements[k])form.elements[k].value=v}
  document.querySelector('#preset').value='random';
  predict();
}
function getValues(){const v={};for(const k of model.numeric_features)v[k]=Number(form.elements[k].value);for(const k of model.categorical_features)v[k]=form.elements[k].value;return v}
function score(v){let x=[];for(const k of model.numeric_features)x.push((v[k]-model.numeric_means[k])/(model.numeric_scales[k]||1));for(const k of model.categorical_features)for(const level of model.categorical_levels[k].slice(1))x.push(v[k]===level?1:0);return model.intercept+x.reduce((s,val,i)=>s+val*model.coefficients[i],0)}
function predict(){if(!model||!form.reportValidity())return;const v=getValues();const raw=score(v);const idx=Math.max(0,Math.min(4,Math.round(raw)));const stage='ABCDE'[idx],meta=stages[stage];document.documentElement.style.setProperty('--stage',meta.color);document.querySelector('#stage-letter').textContent=stage;document.querySelector('#stage-name').textContent=meta.name;document.querySelector('#stage-description').textContent=meta.desc;document.querySelector('#score').textContent=raw.toFixed(2);document.querySelector('#track-marker').style.left=`${Math.max(0,Math.min(100,raw/4*100))}%`;const signals=[['MAP',`${v.map_mmhg} mmHg`],['Cardiac index',`${v.ci_l_min_m2} L/min/m²`],['Lactate',`${v.lactate_mmol_l} mmol/L`],['SvO₂',`${v.svo2_pct}%`],['Urine output',`${v.urine_output_ml_kg_hr} mL/kg/hr`],['Neurology',pretty(v.neurological_assessment)]];document.querySelector('#signal-list').innerHTML=signals.map(([a,b])=>`<div class="signal"><em>${a}</em><b>${b}</b></div>`).join('')}
form.addEventListener('submit',e=>{e.preventDefault();predict();document.querySelector('.result-panel').scrollIntoView({behavior:'smooth',block:'start'})});
document.querySelector('#preset').addEventListener('change',e=>{loadPreset(e.target.value);predict()});
document.querySelector('#random-patient').addEventListener('click',generateTestPatient);
document.querySelector('#reset').addEventListener('click',()=>{document.querySelector('#preset').value='C';loadPreset('C');predict()});
