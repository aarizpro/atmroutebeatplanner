export const fields=['ATMID','MspACCOUNT','BANKCODE','LOCATION','HUBLOCATION','SUBLOCATION','ATMTYPE','CASHLOADINGMETHOD','ROUTE','ADDRESS','Longitude','Latitude'];
export const pairKey=a=>JSON.stringify([a.MspACCOUNT,a.BANKCODE]);
export const validCoordinates=(lat,lon)=>lat!==null&&lat!==undefined&&lat!==''&&lon!==null&&lon!==undefined&&lon!==''&&Number.isFinite(Number(lat))&&Number.isFinite(Number(lon))&&Number(lat)>=-90&&Number(lat)<=90&&Number(lon)>=-180&&Number(lon)<=180&&!(Number(lat)===0&&Number(lon)===0);
export function normalizeATM(row){
 const upper=Object.fromEntries(Object.entries(row).map(([k,v])=>[k.trim().toUpperCase(),v]));
 const a={};for(const f of fields)a[f]=String(upper[f.toUpperCase()]??'').trim();
 for(const f of ['Latitude','Longitude'])a[f]=a[f]===''?null:Number(a[f]);
 a.MspACCOUNT=a.MspACCOUNT.toUpperCase();a.BANKCODE=a.BANKCODE.toUpperCase();
 a.active=!['FALSE','0','INACTIVE','NO'].includes(String(upper.ACTIVE??upper.STATUS??'TRUE').trim().toUpperCase());
 if(!a.ATMID||!a.MspACCOUNT||!a.BANKCODE)throw Error('ATMID, MspACCOUNT and BANKCODE are required.');
 return a;
}
export function distance(a,b){const rad=Math.PI/180,lat1=Number(a.Latitude??a.latitude)*rad,lat2=Number(b.Latitude??b.latitude)*rad,dlat=lat2-lat1,dlon=(Number(b.Longitude??b.longitude)-Number(a.Longitude??a.longitude))*rad;const h=Math.sin(dlat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dlon/2)**2;return 6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));}
export function capacityFor(db,b,request={}){const value=request.branchCapacities?.[b.id]||{};return {minSize:value.minSize??b.minATMs??db.settings.minSize??35,maxSize:value.maxSize??b.maxATMs??db.settings.maxSize??40};}
// Shared pairs are eligible for either branch; exclusive pairs never move.
function resolveLegacyAssignments(db,request={}){
 const active=db.atms.filter(a=>a.active),rules=new Map(db.allocations.map(a=>[pairKey(a),a.branchId])),assignment={},shared=[],issues=[];
 const branches=db.branches,ready=branches.length===2&&branches.every(b=>validCoordinates(b.latitude,b.longitude));
 for(const a of active){const rule=rules.get(pairKey(a));if(rule==='BOTH'){shared.push(a);if(ready&&validCoordinates(a.Latitude,a.Longitude))assignment[a.ATMID]=distance(a,branches[0])<=distance(a,branches[1])?branches[0].id:branches[1].id;}else if(branches.some(b=>b.id===rule))assignment[a.ATMID]=rule;}
 if(shared.length&&!ready)issues.push('Both branches allocation requires valid coordinates for Ambattur and T Nagar.');
 let adjustedCount=0;
 if(shared.length&&ready&&active.every(a=>validCoordinates(a.Latitude,a.Longitude)&&assignment[a.ATMID])){
  const [b0,b1]=branches,fixed0=active.filter(a=>rules.get(pairKey(a))===b0.id).length,fixed1=active.filter(a=>rules.get(pairKey(a))===b1.id).length,total=active.length;
  const ranked=shared.map(a=>({a,delta:distance(a,b0)-distance(a,b1)})).sort((a,b)=>a.delta-b.delta||a.a.ATMID.localeCompare(b.a.ATMID));
  const nearest0=ranked.filter(x=>x.delta<=0).length,prefix=[0];for(const x of ranked)prefix.push(prefix.at(-1)+x.delta);
  let best=null;
  const totalRoutes=request.totalRoutes??db.settings.totalRoutes??45,c0=capacityFor(db,b0,request),c1=capacityFor(db,b1,request);
  for(let k=0;k<=totalRoutes;k++){
   if(request.branchRoutes&&(request.branchRoutes[b0.id]!==k||request.branchRoutes[b1.id]!==totalRoutes-k))continue;
   const low=Math.max(c0.minSize*k,total-c1.maxSize*(totalRoutes-k),fixed0),high=Math.min(c0.maxSize*k,total-c1.minSize*(totalRoutes-k),total-fixed1);
   if(low>high)continue;
   const n0=Math.max(low,Math.min(high,fixed0+nearest0)),take=n0-fixed0,cost=prefix[take],movement=Math.abs(take-nearest0);
   if(!best||cost<best.cost-1e-8||(Math.abs(cost-best.cost)<1e-8&&movement<best.movement))best={take,cost,movement};
  }
  if(best){ranked.forEach((x,i)=>assignment[x.a.ATMID]=i<best.take?b0.id:b1.id);adjustedCount=best.movement;}
  else issues.push('The fixed allocations and shared ATMs cannot satisfy the requested route counts and ATM capacities. Change allocations or counts.');
 }
 return {assignment,issues,sharedCount:shared.length,adjustedCount};
}
export function configuredRoutes(db,request={}){
 if(request.branchRoutes!==undefined)return request.branchRoutes;
 if(db.branches.every(b=>Number.isInteger(b.routeCount)))return Object.fromEntries(db.branches.map(b=>[b.id,b.routeCount]));
 return null;
}
export function resolveAssignments(db,request={}){
 const counts=configuredRoutes(db,request);
 if(!counts&&db.branches.length===2)return resolveLegacyAssignments(db,request);
 const assignment={},issues=[],rules=new Map(db.allocations.map(a=>[pairKey(a),a.branchId]));
 const active=db.atms.filter(a=>a.active),shared=active.filter(a=>rules.get(pairKey(a))==='BOTH');
 const ready=db.branches.every(b=>validCoordinates(b.latitude,b.longitude));
 const nearest={};for(const a of active){const rule=rules.get(pairKey(a));if(rule==='BOTH'){if(ready&&validCoordinates(a.Latitude,a.Longitude)){const b=[...db.branches].sort((b,c)=>distance(a,b)-distance(a,c)||b.id.localeCompare(c.id))[0];if(b)assignment[a.ATMID]=nearest[a.ATMID]=b.id;}}else if(db.branches.some(b=>b.id===rule))assignment[a.ATMID]=rule;}
 if(shared.length&&!ready)issues.push('Shared / Both branches allocation requires valid coordinates for every branch.');
 if(!counts){issues.push('Set a route count for each branch before generating the beat plan.');return {assignment,issues,sharedCount:shared.length,adjustedCount:0};}
 if(shared.length&&ready&&active.every(a=>assignment[a.ATMID]&&validCoordinates(a.Latitude,a.Longitude))&&db.branches.every(b=>Number.isInteger(counts[b.id])&&counts[b.id]>=0)){
  const branches=db.branches.map(b=>({...b,min:capacityFor(db,b,request).minSize*counts[b.id],max:capacityFor(db,b,request).maxSize*counts[b.id],count:active.filter(a=>assignment[a.ATMID]===b.id).length,fixed:active.filter(a=>rules.get(pairKey(a))===b.id).length}));
  if(branches.some(b=>b.fixed>b.max)||branches.reduce((n,b)=>n+Math.max(b.min,b.fixed),0)>active.length||branches.reduce((n,b)=>n+b.max,0)<active.length)issues.push('Fixed allocations and shared ATMs cannot fit the requested branch route counts.');
  else{
   // Only shared ATMs move. Repair over-capacity branches, then fill branch minimums.
   for(const phase of ['excess','deficit'])for(let iteration=0;iteration<active.length;iteration++){
    const targets=branches.filter(b=>phase==='deficit'?b.count<b.min:b.count<b.max);
    const sources=branches.filter(b=>phase==='excess'?b.count>b.max:b.count>Math.max(b.min,b.fixed));
    if(!(phase==='excess'?sources.length:targets.length))break;
    let best=null;for(const a of shared){const from=sources.find(b=>b.id===assignment[a.ATMID]);if(!from)continue;for(const to of targets){if(to.id===from.id)continue;const cost=distance(a,to)-distance(a,from);if(!best||cost<best.cost-1e-9)best={a,from,to,cost};}}
    if(!best){issues.push('Shared ATMs could not satisfy the branch capacities. Review allocations.');break;}
    assignment[best.a.ATMID]=best.to.id;best.from.count--;best.to.count++;
   }
  }
 }
 return {assignment,issues,sharedCount:shared.length,adjustedCount:shared.filter(a=>assignment[a.ATMID]!==nearest[a.ATMID]).length};
}
export function feasibility(db,request={}){
 const manual=configuredRoutes(db,request),settings={...db.settings};
 for(const k of ['minSize','maxSize'])if(request[k]!==undefined)settings[k]=request[k];
 if(request.returnToBranch!==undefined)settings.returnToBranch=request.returnToBranch;
 const errors=[];for(const b of db.branches){const c=capacityFor({...db,settings},b,request);if(!Number.isInteger(c.minSize)||!Number.isInteger(c.maxSize)||c.minSize<1||c.maxSize<c.minSize||c.maxSize>2000)errors.push(`${b.name}: enter whole ATM counts with 1 <= minimum <= maximum <= 2,000.`);}
 if(!db.branches.length)errors.push('Add at least one branch.');
 if(manual){if(Object.keys(manual).length!==db.branches.length||db.branches.some(b=>!Number.isInteger(manual[b.id])||manual[b.id]<0||manual[b.id]>1000))errors.push('Enter a whole route count from 0 to 1,000 for every branch.');settings.totalRoutes=db.branches.reduce((n,b)=>n+(Number.isInteger(manual[b.id])?manual[b.id]:0),0);}
 else settings.totalRoutes=request.totalRoutes??db.settings.totalRoutes??45;
 const {totalRoutes}=settings;if(!Number.isInteger(totalRoutes)||totalRoutes<1||totalRoutes>1000)errors.push('Total route count must be between 1 and 1,000.');
 const active=db.atms.filter(a=>a.active),invalid=active.filter(a=>!validCoordinates(a.Latitude,a.Longitude));
 if(invalid.length)errors.push(`${invalid.length} active ATMs need valid coordinates before generation.`);
 const capacityInputValid=Number.isInteger(totalRoutes)&&totalRoutes>=1&&totalRoutes<=1000&&db.branches.every(b=>{const c=capacityFor({...db,settings},b,request);return Number.isInteger(c.minSize)&&Number.isInteger(c.maxSize)&&c.minSize>=1&&c.maxSize>=c.minSize&&c.maxSize<=2000&&(!manual||Number.isInteger(manual[b.id])&&manual[b.id]>=0&&manual[b.id]<=1000);});
 const resolution=capacityInputValid?resolveAssignments({...db,settings},request):{assignment:{},issues:[],sharedCount:0,adjustedCount:0},assignment=resolution.assignment;errors.push(...resolution.issues);
 const rules=new Map(db.allocations.map(a=>[pairKey(a),a.branchId]));const unassigned=active.filter(a=>rules.get(pairKey(a))!=='BOTH'&&!db.branches.some(b=>b.id===rules.get(pairKey(a))));
 if(unassigned.length)errors.push(`${unassigned.length} active ATMs have an unallocated MSP–Bank pair.`);
 const branches=db.branches.map(b=>{const count=active.filter(a=>assignment[a.ATMID]===b.id).length;return {...b,count,...capacityFor({...db,settings},b,request),minRoutes:Math.ceil(count/capacityFor({...db,settings},b,request).maxSize),maxRoutes:Math.floor(count/capacityFor({...db,settings},b,request).minSize)};});
 for(const b of branches){if((b.count||manual?.[b.id])&&!validCoordinates(b.latitude,b.longitude))errors.push(`Enter valid coordinates for ${b.name}.`);const k=manual?.[b.id];if(k!==undefined&&(b.count<k*b.minSize||b.count>k*b.maxSize))errors.push(`${b.name}: ${b.count} ATMs do not fit ${k} routes (requires ${k*b.minSize}–${k*b.maxSize}).`);
  if(b.count||k){for(const id of [b.startBranchId||b.id,b.endBranchId||(settings.returnToBranch===false?null:b.id)])if(id){const endpoint=db.branches.find(x=>x.id===id);if(!endpoint||!validCoordinates(endpoint.latitude,endpoint.longitude))errors.push(`${b.name}: start/end branch ${id} needs valid coordinates.`);}}
 }
 const lower=branches.reduce((n,b)=>n+b.minRoutes,0),upper=branches.reduce((n,b)=>n+b.maxRoutes,0);
 const requiredMin=manual?branches.reduce((n,b)=>n+(manual[b.id]||0)*b.minSize,0):totalRoutes*Math.min(...branches.map(b=>b.minSize)),requiredMax=manual?branches.reduce((n,b)=>n+(manual[b.id]||0)*b.maxSize,0):totalRoutes*Math.max(...branches.map(b=>b.maxSize));
 if(active.length<requiredMin||active.length>requiredMax)errors.push(`${active.length} active ATMs: the requested routes require ${requiredMin}–${requiredMax} ATMs. Update route counts, ATM counts or allocations.`);
 if(lower>totalRoutes||upper<totalRoutes)errors.push(`Branch allocation permits ${lower}–${upper} routes; redistribute MSP–Bank pairs or update route counts to allow ${totalRoutes}.`);
 let counts=manual?branches.map(b=>manual[b.id]):branches.map(b=>b.minRoutes);
 if(!manual&&!errors.length)while(counts.reduce((a,b)=>a+b,0)<totalRoutes){let best=-1;for(let i=0;i<branches.length;i++)if(counts[i]<branches[i].maxRoutes&&(best<0||branches[i].count/(counts[i]+1)>branches[best].count/(counts[best]+1)))best=i;if(best<0)break;counts[best]++;}
 return {ok:errors.length===0,errors,activeCount:active.length,invalidIds:invalid.map(a=>a.ATMID),unassignedCount:unassigned.length,branches:branches.map((b,i)=>({...b,proposedRoutes:counts[i]})),settings,requiredMin,requiredMax,assignments:assignment,sharedCount:resolution.sharedCount,adjustedCount:resolution.adjustedCount};
}
// Recursive spatial bisection uses exact leaf capacities. It never drops or duplicates ATMs.
function partition(points,capacities){if(capacities.length===1)return [points];const mid=Math.floor(capacities.length/2),cut=capacities.slice(0,mid).reduce((a,b)=>a+b,0);const lats=points.map(a=>a.Latitude),lons=points.map(a=>a.Longitude),latSpan=Math.max(...lats)-Math.min(...lats),lonSpan=(Math.max(...lons)-Math.min(...lons))*Math.cos(points.reduce((n,a)=>n+a.Latitude,0)/points.length*Math.PI/180);const axis=lonSpan>latSpan?'Longitude':'Latitude';const sorted=[...points].sort((a,b)=>a[axis]-b[axis]||a.ATMID.localeCompare(b.ATMID));return [...partition(sorted.slice(0,cut),capacities.slice(0,mid)),...partition(sorted.slice(cut),capacities.slice(mid))];}
function center(points){return {Latitude:points.reduce((n,a)=>n+a.Latitude,0)/points.length,Longitude:points.reduce((n,a)=>n+a.Longitude,0)/points.length};}
function compact(groups){for(let pass=0;pass<4;pass++){const centers=groups.map(center);let changes=0;for(let i=0;i<groups.length;i++)for(let j=i+1;j<groups.length;j++){let best=0,ii=-1,jj=-1;for(let a=0;a<groups[i].length;a++){const x=groups[i][a],dx=distance(x,centers[j])-distance(x,centers[i]);for(let b=0;b<groups[j].length;b++){const y=groups[j][b],delta=dx+distance(y,centers[i])-distance(y,centers[j]);if(delta<best-0.001){best=delta;ii=a;jj=b;}}}if(ii>=0){[groups[i][ii],groups[j][jj]]=[groups[j][jj],groups[i][ii]];changes++;}}if(!changes)break;}return groups;}
export function orderStops(points,branch,returnToBranch=true,endBranch=branch){const left=[...points],route=[];let at=branch;while(left.length){let best=0;for(let i=1;i<left.length;i++)if(distance(at,left[i])<distance(at,left[best]))best=i;at=left.splice(best,1)[0];route.push(at);}
 for(let pass=0;pass<15;pass++){let improved=false;for(let i=0;i<route.length-1;i++)for(let j=i+1;j<route.length;j++){const before=i?route[i-1]:branch,after=j+1<route.length?route[j+1]:returnToBranch?endBranch:null;const old=distance(before,route[i])+(after?distance(route[j],after):0),next=distance(before,route[j])+(after?distance(route[i],after):0);if(next<old-0.0001){route.splice(i,j-i+1,...route.slice(i,j+1).reverse());improved=true;}}if(!improved)break;}
 let cumulative=0,prev=branch;const stops=route.map((a,i)=>{const legKm=distance(prev,a);cumulative+=legKm;prev=a;return {atmId:a.ATMID,sequence:i+1,legKm:+legKm.toFixed(3),cumulativeKm:+cumulative.toFixed(3)};});const returnKm=returnToBranch&&route.length?distance(prev,endBranch):0;return {stops,distanceKm:+(cumulative+returnKm).toFixed(2),returnKm:+returnKm.toFixed(2)};}
export function generateRoutes(db,request={}){const report=feasibility(db,request);if(!report.ok){const e=Error(report.errors.join(' '));e.report=report;throw e;}const assignments=report.assignments;const routes=[];
 for(const b of report.branches){const points=db.atms.filter(a=>a.active&&assignments[a.ATMID]===b.id);const k=b.proposedRoutes;if(!k)continue;const q=Math.floor(points.length/k),remainder=points.length%k;const groups=compact(partition(points,Array.from({length:k},(_,i)=>q+(i<remainder?1:0))));groups.sort((a,c)=>center(c).Latitude-center(a).Latitude||center(a).Longitude-center(c).Longitude);groups.forEach((group,i)=>{const c=center(group),code=`CHE_${b.code}_${String(i+1).padStart(2,'0')}`;routes.push({id:code,code,name:`${b.name} Route ${String(i+1).padStart(2,'0')}`,branchId:b.id,count:group.length,center:c,radiusKm:+Math.max(...group.map(a=>distance(a,c))).toFixed(2),startBranchId:b.startBranchId||b.id,endBranchId:b.endBranchId||(report.settings.returnToBranch===false?null:b.id),...orderStops(group,db.branches.find(x=>x.id===(b.startBranchId||b.id)),!!(b.endBranchId||report.settings.returnToBranch!==false),db.branches.find(x=>x.id===(b.endBranchId||b.id))),returnToBranch:!!(b.endBranchId||report.settings.returnToBranch!==false)});});}
 return {routes,report};
}
