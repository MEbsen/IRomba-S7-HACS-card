// Development builds are published automatically from this branch. Cleaning uses one calm circular motion.
const CARD_VERSION = "0.2.0-dev.2";

const FEATURES = { PAUSE: 4, STOP: 8, RETURN_HOME: 16, LOCATE: 512, CLEAN_SPOT: 1024, START: 8192 };
const STATE_META = {
  docked: ["I dock", "mdi:home-map-marker", "green"],
  charging: ["Oplader", "mdi:battery-charging", "green"],
  cleaning: ["Rengør", "mdi:robot-vacuum", "blue"],
  paused: ["Sat på pause", "mdi:pause-circle", "amber"],
  returning: ["Kører hjem", "mdi:home-import-outline", "blue"],
  error: ["Kræver hjælp", "mdi:alert-circle", "red"],
  idle: ["Klar", "mdi:robot-vacuum", "neutral"],
  unavailable: ["Ikke tilgængelig", "mdi:cloud-off-outline", "neutral"],
  unknown: ["Ukendt status", "mdi:help-circle-outline", "neutral"]
};
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));

class IRoombaS7Card extends HTMLElement {
  constructor() { super(); this.attachShadow({mode:"open"}); this._related={}; this._loaded=""; this._busy=""; }
  static getStubConfig(hass) { return {entity:Object.keys(hass?.states||{}).find(id=>id.startsWith("vacuum."))||"",show_stats:true}; }
  static getConfigElement() { return document.createElement("iroomba-s7-card-editor"); }
  setConfig(config) { if(!config?.entity) throw new Error("Vælg en vacuum-entitet"); this._config={show_stats:true,...config}; this._loaded=""; this.render(); this._discover(); }
  set hass(hass) { this._hass=hass; this.render(); this._discover(); }
  getCardSize() { return this._config?.show_stats===false?5:7; }
  _vacuum() { return this._hass?.states?.[this._config?.entity]; }
  _state(id) { return id?this._hass?.states?.[id]:undefined; }
  _on(id) { return ["on","true","charging","yes","1"].includes(String(this._state(id)?.state||"").toLowerCase()); }
  _supports(bit) { return (Number(this._vacuum()?.attributes?.supported_features||0)&bit)===bit; }
  _normal(v) { if(!v||["unavailable","unknown"].includes(v.state)) return v?.state||"unavailable"; if(v.state==="docked"&&this._on(this._related.charging))return "charging"; return STATE_META[v.state]?v.state:"unknown"; }
  async _discover() {
    const id=this._config?.entity; if(!this._hass||!id||this._loaded===id)return; this._loaded=id;
    try {
      const registry=await this._hass.callWS({type:"config/entity_registry/list"});
      const vacuum=registry.find(e=>e.entity_id===id); if(!vacuum?.device_id)return;
      const entries=registry.filter(e=>e.device_id===vacuum.device_id&&!e.disabled_by);
      const find=(...patterns)=>entries.find(e=>{const h=[e.entity_id,e.original_name,e.name,e.translation_key,e.unique_id].filter(Boolean).join(" ").toLowerCase();return patterns.some(p=>h.includes(p));})?.entity_id;
      this._related={
        battery:find("battery"), charging:find("charging"), binFull:find("bin_full","bin full"),
        average:find("average_mission_time","average mission time"), total:find("total_missions","total missions"),
        success:find("successful_missions","successful missions"), failed:find("failed_missions","failed missions"),
        canceled:find("canceled_missions","cancelled_missions","canceled missions","cancelled missions"),
        cleaningTime:find("total_cleaning_time","total cleaning time")
      }; this.render();
    } catch(error) { console.warn("iRoomba S7 Card: entity discovery failed",error); }
  }
  async _call(service) {
    if(!this._hass||this._busy)return; this._busy=service; this.render();
    try { await this._hass.callService("vacuum",service,{entity_id:this._config.entity}); }
    catch(error) { console.error(`iRoomba S7 Card: vacuum.${service} failed`,error); }
    finally { this._busy=""; this.render(); }
  }
  _moreInfo(entityId) { if(entityId)this.dispatchEvent(new CustomEvent("hass-more-info",{detail:{entityId},bubbles:true,composed:true})); }
  _button(service,icon,label,show,primary=false) {
    if(!show)return ""; const busy=this._busy===service;
    return `<button class="${primary?"primary":""}" data-service="${service}" ${this._busy?"disabled":""}><ha-icon class="${busy?"spin":""}" icon="${busy?"mdi:loading":icon}"></ha-icon><span>${esc(label)}</span></button>`;
  }
  _stat(id,label) { const s=this._state(id); if(!s||["unknown","unavailable"].includes(s.state))return ""; const unit=s.attributes?.unit_of_measurement||""; return `<div class="stat" data-info="${esc(id)}"><span>${esc(label)}</span><b>${esc(s.state)}${unit?" "+esc(unit):""}</b></div>`; }
  _maintenanceKey(){return `iroomba-s7-card:${this._config.entity}:maintenance`;}
  _maintenanceState(){try{return JSON.parse(localStorage.getItem(this._maintenanceKey())||"{}")||{};}catch{return {};}}
  _metric(unit){
    if(unit==="days")return Date.now()/86400000;
    if(unit==="runs")return Number(this._state(this._related.total)?.state);
    const s=this._state(this._related.cleaningTime),value=Number(s?.state),u=String(s?.attributes?.unit_of_measurement||"").toLowerCase();
    return Number.isFinite(value)?value*(u==="h"||u.includes("hour")?60:1):NaN;
  }
  _resetMaintenance(part){
    const data=this._maintenanceState(),unit=this._config[`${part}_unit`]||"runs",metric=this._metric(unit);
    data[part]={at:Date.now(),baseline:Number.isFinite(metric)?metric:0};
    try{localStorage.setItem(this._maintenanceKey(),JSON.stringify(data));}catch(error){console.warn("iRoomba S7 Card: maintenance reset could not be saved",error);}
    this.render();
  }
  _maintenance(part,label,icon){
    const interval=Number(this._config[`${part}_interval`]||0); if(!(interval>0))return "";
    const unit=this._config[`${part}_unit`]||"runs",saved=this._maintenanceState()[part],now=this._metric(unit);
    if(!saved||!Number.isFinite(now))return `<div class="serviceItem muted"><ha-icon icon="${icon}"></ha-icon><div><b>${label}</b><span>${saved?"Mangler statistik for den valgte enhed":"Tryk nulstil efter næste skift"}</span></div><button class="mini" data-reset="${part}">Nulstil</button></div>`;
    const used=Math.max(0,now-Number(saved.baseline||0)),remaining=Math.ceil(interval-used),ratio=Math.min(1,used/interval),overdue=remaining<=0,warn=!overdue&&ratio>=.8;
    const units=unit==="days"?"dage":unit==="minutes"?"min.":"ture";
    return `<div class="serviceItem ${overdue?"overdue":warn?"warn":""}"><ha-icon icon="${icon}"></ha-icon><div class="serviceText"><b>${label}</b><span>${overdue?`Skift nu · ${Math.abs(remaining)} ${units} over`:`${remaining} ${units} tilbage`}</span><i><em style="width:${Math.round(ratio*100)}%"></em></i></div><button class="mini" data-reset="${part}">Nulstil</button></div>`;
  }
  render() {
    if(!this._config)return; const v=this._vacuum();
    if(!v){this.shadowRoot.innerHTML=`<ha-card><div class="missing">Entiteten <code>${esc(this._config.entity)}</code> blev ikke fundet.</div></ha-card>`;return;}
    const state=this._normal(v), meta=STATE_META[state]||STATE_META.unknown, title=this._config.title||v.attributes?.friendly_name||"Roomba";
    const rawBattery=this._state(this._related.battery)?.state??v.attributes?.battery_level, battery=Number(rawBattery);
    const binFull=this._on(this._related.binFull)||v.attributes?.bin_full===true, binPresent=v.attributes?.bin_present!==false;
    const active=["cleaning","returning"].includes(state);
    const controls=[
      this._button("start","mdi:play",state==="paused"?"Fortsæt":"Start",this._supports(FEATURES.START)&&!active,true),
      this._button("pause","mdi:pause","Pause",this._supports(FEATURES.PAUSE)&&state==="cleaning"),
      this._button("stop","mdi:stop","Stop",this._supports(FEATURES.STOP)&&["cleaning","paused","returning"].includes(state)),
      this._button("return_to_base","mdi:home-import-outline","Kør hjem",this._supports(FEATURES.RETURN_HOME)&&!["docked","charging","returning"].includes(state)),
      this._button("locate","mdi:map-marker-sound","Find",this._supports(FEATURES.LOCATE)),
      this._button("clean_spot","mdi:target","Spot",this._supports(FEATURES.CLEAN_SPOT)&&!active)
    ].join("");
    const stats=[this._stat(this._related.average,"Gns. rengøring"),this._stat(this._related.success,"Gennemført"),this._stat(this._related.failed,"Fejlet"),this._stat(this._related.canceled,"Afbrudt"),this._stat(this._related.total,"Ture i alt")].join("");
    const maintenance=[this._maintenance("filter","Filter","mdi:air-filter"),this._maintenance("brush","Børster","mdi:brush-variant")].join("");
    this.shadowRoot.innerHTML=`<style>
      :host{display:block;--accent:var(--primary-color,#03a9f4)}*{box-sizing:border-box}ha-card{overflow:hidden;color:var(--primary-text-color);--state:var(--secondary-text-color,#888)}ha-card[data-tone=green]{--state:var(--success-color,#43a047)}ha-card[data-tone=blue]{--state:var(--info-color,var(--accent))}ha-card[data-tone=amber]{--state:var(--warning-color,#ff9800)}ha-card[data-tone=red]{--state:var(--error-color,#db4437)}
      .card{padding:20px}.header{display:flex;justify-content:space-between;gap:16px}.header h2{font-size:20px;margin:0 0 4px}.status{display:flex;gap:7px;align-items:center;color:var(--secondary-text-color);font-size:14px}.status ha-icon{width:18px;color:var(--state)}.version{font-size:10px;color:var(--disabled-text-color);margin-top:5px}.battery{display:flex;gap:7px;align-items:center;padding:5px 10px;border-radius:999px;background:var(--secondary-background-color);cursor:pointer}.battery ha-icon{width:20px;color:${battery<20?"var(--error-color)":"var(--success-color,#43a047)"}}
      .scene{height:238px;margin:14px -6px;display:grid;place-items:center;position:relative;isolation:isolate;overflow:hidden;border-radius:18px;background:radial-gradient(circle at 68% 30%,color-mix(in srgb,var(--state) 17%,transparent),transparent 34%),linear-gradient(160deg,#18242d,#0d1217 62%,#151a1e)}.floor{position:absolute;inset:42% -15% -35%;background:repeating-linear-gradient(96deg,#ffffff08 0 1px,transparent 1px 54px);transform:perspective(260px) rotateX(58deg);border-top:1px solid #ffffff12}.glow{position:absolute;width:220px;height:110px;border-radius:50%;background:var(--state);filter:blur(44px);opacity:.15;transform:translateY(50px);z-index:-1}.route{position:absolute;width:250px;height:150px;opacity:${active?.65:.13}}.route ellipse{fill:none;stroke:var(--state);stroke-width:2.5;stroke-linecap:round;stroke-dasharray:5 12}.robotWrap{position:relative;width:150px;height:150px;display:grid;place-items:center;z-index:2;filter:drop-shadow(0 18px 14px #0009);transform-origin:center}.robot{z-index:2;width:124px;height:124px;border-radius:50%;background:linear-gradient(145deg,#3c4650,#10151a);border:3px solid #66727c;box-shadow:inset 0 2px 5px #ffffff2b;position:relative}.robot:before{content:"";position:absolute;inset:17px;border-radius:50%;border:2px solid #77818a;background:radial-gradient(circle at 45% 40%,#46515a,#1b2025 68%)}.lid{position:absolute;width:38px;height:28px;border-radius:10px;left:43px;top:26px;background:#0d1115;border:2px solid #56616a}.clean{position:absolute;width:19px;height:19px;border-radius:50%;left:52px;top:64px;background:var(--state);box-shadow:0 0 14px var(--state)}.brush{z-index:1;position:absolute;width:28px;height:28px;right:8px;bottom:13px;opacity:.58}.brush:before,.brush:after{content:"";position:absolute;left:13px;width:2px;height:28px;background:#6f9149;border-radius:4px}.brush:after{transform:rotate(60deg)}.dock{position:absolute;right:25px;bottom:28px;width:50px;height:62px;border-radius:12px 12px 4px 4px;background:linear-gradient(#4d5962,#151a1f);border:2px solid #68757f;box-shadow:0 0 28px color-mix(in srgb,var(--state) 28%,transparent)}.dock:before{content:"";position:absolute;width:10px;height:10px;border-radius:50%;background:var(--state);left:18px;top:12px;box-shadow:0 0 12px var(--state)}.dock:after{content:"";position:absolute;left:-12px;right:-12px;bottom:-8px;height:12px;border-radius:10px;background:#23292e;border:2px solid #59636c}
      .cleaning .robotWrap{animation:circleDrive 8s linear infinite}.cleaning .brush{animation:rotate 1.15s linear infinite}.returning .robotWrap{animation:returnDock 2.6s ease-in-out infinite}.charging .clean,.docked .clean{animation:pulse 2s ease-in-out infinite}.error .robot{animation:shake .5s linear infinite}.alerts{display:grid;gap:8px;margin-bottom:14px}.alert{display:flex;gap:9px;align-items:center;padding:9px 11px;border-radius:10px;font-size:13px;background:color-mix(in srgb,var(--warning-color,#ff9800) 14%,transparent)}.alert ha-icon{color:var(--warning-color,#ff9800)}
      .controls{display:grid;grid-template-columns:repeat(auto-fit,minmax(72px,1fr));gap:9px}button{border:1px solid var(--divider-color);background:var(--secondary-background-color);color:var(--primary-text-color);min-height:58px;border-radius:12px;padding:8px 6px;display:grid;place-items:center;gap:4px;cursor:pointer;font:inherit;font-size:12px}button.primary{background:var(--accent);color:#fff;border-color:transparent}button:disabled{opacity:.55}.maintenance{display:grid;gap:8px;margin-top:14px;padding-top:14px;border-top:1px solid var(--divider-color)}.serviceTitle{font-size:12px;font-weight:700;letter-spacing:.08em;color:var(--secondary-text-color)}.serviceItem{display:grid;grid-template-columns:28px 1fr auto;align-items:center;gap:10px;padding:11px;border-radius:12px;background:linear-gradient(110deg,color-mix(in srgb,var(--success-color,#43a047) 10%,var(--secondary-background-color)),var(--secondary-background-color))}.serviceItem>ha-icon{color:var(--success-color,#43a047)}.serviceItem.warn{background:color-mix(in srgb,var(--warning-color,#ff9800) 14%,var(--secondary-background-color))}.serviceItem.warn>ha-icon{color:var(--warning-color,#ff9800)}.serviceItem.overdue{background:color-mix(in srgb,var(--error-color,#db4437) 16%,var(--secondary-background-color));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--error-color) 45%,transparent)}.serviceItem.overdue>ha-icon{color:var(--error-color,#db4437);animation:pulse 1.2s infinite}.serviceText{display:grid;gap:3px}.serviceText span,.serviceItem.muted span{font-size:12px;color:var(--secondary-text-color)}.serviceText i{height:4px;border-radius:4px;background:#0004;overflow:hidden}.serviceText em{display:block;height:100%;background:currentColor}.mini{min-height:34px;padding:5px 9px}.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(105px,1fr));gap:8px;margin-top:14px;padding-top:14px;border-top:1px solid var(--divider-color)}.stat{background:var(--secondary-background-color);padding:9px 10px;border-radius:10px;display:grid;gap:3px;cursor:pointer}.stat span{font-size:11px;color:var(--secondary-text-color)}.stat b{font-size:14px}.missing{padding:20px}.spin{animation:rotate 1s linear infinite}
      @keyframes rotate{to{transform:rotate(360deg)}}@keyframes pulse{50%{opacity:.45}}@keyframes circleDrive{from{transform:rotate(0deg) translateX(43px) rotate(88deg)}to{transform:rotate(360deg) translateX(43px) rotate(88deg)}}@keyframes returnDock{0%,100%{transform:translateX(-28px) rotate(0)}55%{transform:translateX(28px) rotate(10deg)}}@keyframes shake{25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}@media(max-width:420px){.card{padding:16px}.scene{height:210px}.controls{grid-template-columns:repeat(3,1fr)}}@media(prefers-reduced-motion:reduce){*{animation-duration:.001ms!important;animation-iteration-count:1!important}}
    </style><ha-card data-tone="${meta[2]}"><div class="card"><div class="header"><div><h2>${esc(title)}</h2><div class="status"><ha-icon icon="${meta[1]}"></ha-icon>${esc(meta[0])}</div><div class="version">v${CARD_VERSION}</div></div>${Number.isFinite(battery)?`<div class="battery" data-info="${esc(this._related.battery||this._config.entity)}"><ha-icon icon="${this._on(this._related.charging)?"mdi:battery-charging":"mdi:battery"}"></ha-icon><b>${Math.round(battery)}%</b></div>`:""}</div>
    <div class="scene ${esc(state)}"><div class="floor"></div><div class="glow"></div><svg class="route" viewBox="0 0 250 150"><ellipse cx="125" cy="75" rx="88" ry="48"/></svg><div class="robotWrap"><div class="brush"></div><div class="robot"><div class="lid"></div><div class="clean"></div></div></div><div class="dock"></div></div>
    <div class="alerts">${binFull?`<div class="alert"><ha-icon icon="mdi:delete-alert"></ha-icon>Beholderen er fuld og bør tømmes</div>`:""}${!binPresent?`<div class="alert"><ha-icon icon="mdi:delete-off"></ha-icon>Beholderen er ikke monteret</div>`:""}</div><div class="controls">${controls}</div>${maintenance?`<div class="maintenance"><div class="serviceTitle">VEDLIGEHOLDELSE</div>${maintenance}</div>`:""}${this._config.show_stats!==false&&stats?`<div class="stats">${stats}</div>`:""}</div></ha-card>`;
    this.shadowRoot.querySelectorAll("[data-service]").forEach(b=>b.addEventListener("click",()=>this._call(b.dataset.service)));
    this.shadowRoot.querySelectorAll("[data-info]").forEach(e=>e.addEventListener("click",()=>this._moreInfo(e.dataset.info)));
    this.shadowRoot.querySelectorAll("[data-reset]").forEach(e=>e.addEventListener("click",()=>this._resetMaintenance(e.dataset.reset)));
  }
}

class IRoombaS7CardEditor extends HTMLElement {
  constructor(){super();this.attachShadow({mode:"open"});}
  set hass(hass){this._hass=hass;this.render();} setConfig(config){this._config={show_stats:true,...config};this.render();}
  _fire(config){this._config=config;this.dispatchEvent(new CustomEvent("config-changed",{detail:{config},bubbles:true,composed:true}));}
  render(){if(!this._config)return;const c=this._config;this.shadowRoot.innerHTML=`<style>:host{display:block;padding:8px 0}.grid{display:grid;gap:14px}.field{display:grid;gap:6px}label{font-weight:600}input,select{width:100%;box-sizing:border-box;padding:10px;background:var(--card-background-color);color:var(--primary-text-color);border:1px solid var(--divider-color);border-radius:6px}.toggle{display:flex;justify-content:space-between;align-items:center}.hint{font-size:12px;color:var(--secondary-text-color)}.maintenanceEditor{display:grid;gap:10px;padding:12px;border:1px solid var(--divider-color);border-radius:10px}.maintenanceEditor h4{margin:0}.interval{display:grid;grid-template-columns:1fr 1.3fr;gap:8px}</style><div class="grid"><div class="field"><label>Robotstøvsuger</label><ha-entity-picker data-entity value="${esc(c.entity||"")}" include-domains='["vacuum"]' allow-custom-entity></ha-entity-picker><div class="hint">Vælg entiteten fra iRobot-integrationen.</div></div><div class="field"><label>Titel (valgfri)</label><input data-title value="${esc(c.title||"")}"></div><div class="maintenanceEditor"><h4>Filter</h4><div class="interval"><input data-key="filter_interval" type="number" min="0" value="${Number(c.filter_interval||0)}" placeholder="0 = skjult"><select data-key="filter_unit"><option value="days" ${c.filter_unit==="days"?"selected":""}>Dage</option><option value="runs" ${!c.filter_unit||c.filter_unit==="runs"?"selected":""}>Ture</option><option value="minutes" ${c.filter_unit==="minutes"?"selected":""}>Minutter</option></select></div><div class="hint">Sæt 0 for at skjule tælleren.</div></div><div class="maintenanceEditor"><h4>Børster</h4><div class="interval"><input data-key="brush_interval" type="number" min="0" value="${Number(c.brush_interval||0)}" placeholder="0 = skjult"><select data-key="brush_unit"><option value="days" ${c.brush_unit==="days"?"selected":""}>Dage</option><option value="runs" ${!c.brush_unit||c.brush_unit==="runs"?"selected":""}>Ture</option><option value="minutes" ${c.brush_unit==="minutes"?"selected":""}>Minutter</option></select></div></div><label class="toggle"><span>Vis statistik</span><ha-switch data-stats ${c.show_stats!==false?"checked":""}></ha-switch></label></div>`;const p=this.shadowRoot.querySelector("[data-entity]");if(p)p.hass=this._hass;p?.addEventListener("value-changed",e=>this._fire({...c,entity:e.detail.value}));this.shadowRoot.querySelector("[data-title]")?.addEventListener("change",e=>{const n={...c};if(e.target.value.trim())n.title=e.target.value.trim();else delete n.title;this._fire(n)});this.shadowRoot.querySelectorAll("[data-key]").forEach(e=>e.addEventListener("change",event=>this._fire({...c,[event.target.dataset.key]:event.target.type==="number"?Number(event.target.value):event.target.value})));this.shadowRoot.querySelector("[data-stats]")?.addEventListener("change",e=>this._fire({...c,show_stats:e.target.checked}));}
}
if(!customElements.get("iroomba-s7-card"))customElements.define("iroomba-s7-card",IRoombaS7Card);
if(!customElements.get("iroomba-s7-card-editor"))customElements.define("iroomba-s7-card-editor",IRoombaS7CardEditor);
window.customCards=window.customCards||[];
if(!window.customCards.some(x=>x.type==="iroomba-s7-card"))window.customCards.push({type:"iroomba-s7-card",name:"iRoomba S7 Card",description:"Animated status and control card for iRobot Roomba S7",preview:true});
console.info("%c IROOMBA S7 CARD %c "+CARD_VERSION,"background:#00a8e8;color:white;padding:3px","background:#333;color:white;padding:3px");
