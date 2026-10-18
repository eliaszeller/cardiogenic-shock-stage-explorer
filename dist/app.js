const form=document.querySelector('#assessment-form');
const stages={A:{name:'At-risk pattern',desc:'Stable-pattern inputs in the synthetic training data.',color:'#62d9d3'},B:{name:'Beginning shock pattern',desc:'Instability-pattern inputs without clear synthetic hypoperfusion.',color:'#b6e36f'},C:{name:'Classic shock pattern',desc:'Hypoperfusion pattern in the synthetic training data.',color:'#ffab58'},D:{name:'Deteriorating pattern',desc:'Higher-severity pattern; clinical Stage D requires failed initial support.',color:'#ff6577'},E:{name:'Extremis pattern',desc:'Severe pattern; clinical Stage E requires collapse or equivalent context.',color:'#c58cff'}};
const presets={
 A:{map_mmhg:86,ci_l_min_m2:3.0,lactate_mmol_l:1.1,svo2_pct:70,urine_output_ml_kg_hr:1.0,neurological_assessment:'alert_oriented'},
 B:{map_mmhg:57,ci_l_min_m2:2.45,lactate_mmol_l:1.5,svo2_pct:64,urine_output_ml_kg_hr:.72,neurological_assessment:'alert_oriented'},
 C:{map_mmhg:64,ci_l_min_m2:1.95,lactate_mmol_l:3.2,svo2_pct:54,urine_output_ml_kg_hr:.34,neurological_assessment:'confused'},
 D:{map_mmhg:57,ci_l_min_m2:1.55,lactate_mmol_l:5.5,svo2_pct:45,urine_output_ml_kg_hr:.17,neurological_assessment:'lethargic'},
 E:{map_mmhg:43,ci_l_min_m2:1.0,lactate_mmol_l:11,svo2_pct:34,urine_output_ml_kg_hr:.04,neurological_assessment:'unresponsive'}
};
let model;
function pretty(v){return v.replaceAll('_',' ').replace('2plus','2+').replace('doppler only','Doppler only').replace(/\b\w/g,c=>c.toUpperCase())}
fetch('model.json').then(r=>r.json()).then(m=>{model=m;setupSelects();loadPreset('C');predict();}).catch(()=>{document.querySelector('#stage-description').textContent='Model file could not be loaded.'});
function setupSelects(){for(const key of model.categorical_features){const el=form.elements[key];el.innerHTML=model.categorical_levels[key].map(v=>`<option value="${v}">${pretty(v)}</option>`).join('')}}
function loadPreset(stage){const p=presets[stage];for(const [k,v] of Object.entries(p))if(form.elements[k])form.elements[k].value=v}
function vary(value,fraction,digits=1){const varied=value*(1+(Math.random()*2-1)*fraction);return Number(varied.toFixed(digits))}
function generateTestPatient(){
  const stage='ABCDE'[Math.floor(Math.random()*5)],base={...presets[stage]};
  const patient={...base};
  for(const key of ['map_mmhg','svo2_pct'])patient[key]=vary(base[key],.12,1);
  patient.ci_l_min_m2=vary(base.ci_l_min_m2,.12,2);
  patient.lactate_mmol_l=vary(base.lactate_mmol_l,.18,2);
  patient.urine_output_ml_kg_hr=Math.max(0,vary(base.urine_output_ml_kg_hr,.25,3));
  for(const [k,v] of Object.entries(patient))if(form.elements[k])form.elements[k].value=v;
  document.querySelector('#preset').value='random';
  predict();
}
function getValues(){const v={};for(const k of model.numeric_features)v[k]=Number(form.elements[k].value);for(const k of model.categorical_features)v[k]=form.elements[k].value;return v}
function score(v){let x=[];for(const k of model.numeric_features)x.push((v[k]-model.numeric_means[k])/(model.numeric_scales[k]||1));for(const k of model.categorical_features)for(const level of model.categorical_levels[k].slice(1))x.push(v[k]===level?1:0);return model.intercept+x.reduce((s,val,i)=>s+val*model.coefficients[i],0)}
function neurologicalCoefficient(level){const levels=model.categorical_levels.neurological_assessment;const index=levels.indexOf(level);return index<=0?0:model.coefficients[4+index]}
function formatCoefficient(value){return `β ${value>=0?'+':''}${value.toFixed(3)}`}
function predict(){if(!model||!form.reportValidity())return;const v=getValues();const raw=score(v);const idx=Math.max(0,Math.min(4,Math.round(raw)));const stage='ABCDE'[idx],meta=stages[stage];document.documentElement.style.setProperty('--stage',meta.color);document.querySelector('#stage-letter').textContent=stage;document.querySelector('#stage-name').textContent=meta.name;document.querySelector('#stage-description').textContent=meta.desc;document.querySelector('#score').textContent=raw.toFixed(2);document.querySelector('#track-marker').style.left=`${Math.max(0,Math.min(100,raw/4*100))}%`;const signals=[['MAP',`${v.map_mmhg} mmHg`,model.coefficients[0]],['Cardiac index',`${v.ci_l_min_m2} L/min/m²`,model.coefficients[1]],['Lactate',`${v.lactate_mmol_l} mmol/L`,model.coefficients[2]],['SvO₂',`${v.svo2_pct}%`,model.coefficients[3]],['Urine output',`${v.urine_output_ml_kg_hr} mL/kg/hr`,model.coefficients[4]],['Neurology',pretty(v.neurological_assessment),neurologicalCoefficient(v.neurological_assessment)]];document.querySelector('#signal-list').innerHTML=signals.map(([label,value,coefficient])=>`<div class="signal"><em>${label}</em><span><b>${value}</b><small>${formatCoefficient(coefficient)}</small></span></div>`).join('')}
form.addEventListener('submit',e=>{e.preventDefault();predict();document.querySelector('.result-panel').scrollIntoView({behavior:'smooth',block:'start'})});
document.querySelector('#preset').addEventListener('change',e=>{loadPreset(e.target.value);predict()});
document.querySelector('#random-patient').addEventListener('click',generateTestPatient);
document.querySelector('#reset').addEventListener('click',()=>{document.querySelector('#preset').value='C';loadPreset('C');predict()});
