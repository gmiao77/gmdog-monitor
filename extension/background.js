const DEFAULTS={tasks:[],history:[],settings:{desktopNotifications:true,recoveryNotifications:true,historyLimit:500,focusScanTab:false}};
const MARKETPLACES=["amazon.com","amazon.ca","amazon.co.uk","amazon.de","amazon.fr","amazon.it","amazon.es","amazon.co.jp"];
const getStore=async()=>({...DEFAULTS,...await chrome.storage.local.get(Object.keys(DEFAULTS))});
const setStore=data=>chrome.storage.local.set(data);
function extract(input){
  const raw=String(input||"").trim();const direct=raw.match(/^[A-Z0-9]{10}$/i);if(direct)return{asin:direct[0].toUpperCase(),marketplace:"www.amazon.com"};
  let url;try{url=new URL(raw)}catch{throw Error("请输入有效的Amazon链接或10位ASIN")}
  const market=MARKETPLACES.find(x=>url.hostname.endsWith(x));if(!market)throw Error("暂不支持这个Amazon站点");
  const m=raw.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i)||raw.match(/[?&]asin=([A-Z0-9]{10})/i);if(!m)throw Error("无法从链接中识别10位ASIN");
  return{asin:m[1].toUpperCase(),marketplace:`www.${market}`};
}
function localStamp(){return new Date().toLocaleString("zh-CN",{hour12:false}).replaceAll("/","-")}
function inWindow(task){const now=new Date(),hm=`${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;if(task.startTime<=task.endTime)return hm>=task.startTime&&hm<=task.endTime;return hm>=task.startTime||hm<=task.endTime}
function due(task){return !task.lastCheckedMs||Date.now()-task.lastCheckedMs>=task.intervalMinutes*60000}
async function notify(title,message){const {settings}=await getStore();if(!settings.desktopNotifications)return;await chrome.notifications.create({type:"basic",iconUrl:chrome.runtime.getURL("icon.svg"),title,message,priority:2})}
async function waitTab(tabId,timeout=60000){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{chrome.tabs.onUpdated.removeListener(listener);reject(Error("Amazon页面加载超时"))},timeout);function listener(id,info){if(id===tabId&&info.status==="complete"){clearTimeout(timer);chrome.tabs.onUpdated.removeListener(listener);setTimeout(resolve,2200)}}chrome.tabs.onUpdated.addListener(listener)})}
async function scrapeTask(task){
  const url=`https://${task.marketplace}/dp/${task.asin}`;
  const {settings}=await getStore();let tab;
  try{tab=await chrome.tabs.create({url,active:Boolean(settings.focusScanTab)});await waitTab(tab.id);const result=await chrome.tabs.sendMessage(tab.id,{type:"SCRAPE_OFFERS"});if(!result?.ok)throw Error(result?.error||"读取报价失败");return result}
  finally{if(tab?.id)chrome.tabs.remove(tab.id).catch(()=>{})}
}
async function runTask(id){
  const data=await getStore(),index=data.tasks.findIndex(x=>x.id===id);if(index<0)throw Error("任务不存在");const task=data.tasks[index],checkedAt=localStamp();let entry;
  try{
    const result=await scrapeTask(task),allowed=new Set(task.allowedSellers.map(x=>x.trim().toLowerCase()).filter(Boolean));
    const unauthorized=result.offers.filter(x=>!allowed.has(x.sellerId.toLowerCase())&&!allowed.has(x.sellerName.toLowerCase()));
    const previousStatus=task.lastStatus,status=unauthorized.length?"ALERT":"OK",changed=Boolean(previousStatus)&&previousStatus!==status;
    entry={id:crypto.randomUUID(),taskId:id,name:task.name,asin:task.asin,checkedAt,status,offers:result.offers,unauthorized};
    Object.assign(task,{lastStatus:status,lastCheckedAt:checkedAt,lastCheckedMs:Date.now(),lastError:""});
    if((!previousStatus||changed)&&status==="ALERT")await notify(`发现疑似跟卖｜${task.name}`,`${unauthorized.map(x=>x.sellerName).join("、")}\nASIN: ${task.asin}`);
    if(changed&&status==="OK"&&data.settings.recoveryNotifications)await notify(`跟卖已消失｜${task.name}`,`当前未发现白名单之外的报价卖家\nASIN: ${task.asin}`);
  }catch(error){
    entry={id:crypto.randomUUID(),taskId:id,name:task.name,asin:task.asin,checkedAt,status:"ERROR",offers:[],unauthorized:[],error:error.message};
    Object.assign(task,{lastStatus:"ERROR",lastCheckedAt:checkedAt,lastCheckedMs:Date.now(),lastError:error.message});
  }
  data.history.unshift(entry);data.history=data.history.slice(0,data.settings.historyLimit||500);await setStore({tasks:data.tasks,history:data.history});return entry;
}
async function scanDue(){const {tasks}=await getStore();for(const task of tasks)if(task.enabled&&inWindow(task)&&due(task))await runTask(task.id)}
async function ensureAlarm(){const a=await chrome.alarms.get("monitor-tick");if(!a)await chrome.alarms.create("monitor-tick",{periodInMinutes:1})}
chrome.runtime.onInstalled.addListener(async()=>{await setStore({...DEFAULTS,...await chrome.storage.local.get(Object.keys(DEFAULTS))});await ensureAlarm()});
chrome.runtime.onStartup.addListener(ensureAlarm);chrome.alarms.onAlarm.addListener(a=>{if(a.name==="monitor-tick")scanDue()});
chrome.action.onClicked.addListener(()=>chrome.tabs.create({url:"https://gmiao77.github.io/gmdog-monitor/"}));
chrome.runtime.onMessage.addListener((message,_sender,sendResponse)=>{(async()=>{
  if(message.type==="PING")return{ok:true,data:{version:chrome.runtime.getManifest().version}};
  if(message.type==="GET_STATE")return{ok:true,data:await getStore()};
  if(message.type==="SAVE_TASK"){const data=await getStore(),parsed=extract(message.payload.url),task={id:crypto.randomUUID(),name:message.payload.name||parsed.asin,asin:parsed.asin,marketplace:parsed.marketplace,url:`https://${parsed.marketplace}/dp/${parsed.asin}`,allowedSellers:message.payload.allowedSellers||[],startTime:message.payload.startTime||"08:00",endTime:message.payload.endTime||"23:00",intervalMinutes:Number(message.payload.intervalMinutes)||30,enabled:true,lastStatus:"",lastCheckedAt:"",lastCheckedMs:0,lastError:""};data.tasks.unshift(task);await setStore({tasks:data.tasks});return{ok:true,data:task}}
  if(message.type==="DELETE_TASK"){const data=await getStore();data.tasks=data.tasks.filter(x=>x.id!==message.payload.id);data.history=data.history.filter(x=>x.taskId!==message.payload.id);await setStore({tasks:data.tasks,history:data.history});return{ok:true}}
  if(message.type==="RUN_TASK")return{ok:true,data:await runTask(message.payload.id)};
  if(message.type==="SAVE_SETTINGS"){const data=await getStore(),settings={...data.settings,...message.payload};await setStore({settings});return{ok:true}}
  if(message.type==="CLEAR_HISTORY"){await setStore({history:[]});return{ok:true}}
  if(message.type==="EXPORT_DATA")return{ok:true,data:await getStore()};
  return{ok:false,error:"未知请求"};
})().then(sendResponse).catch(e=>sendResponse({ok:false,error:e.message}));return true});
ensureAlarm();
