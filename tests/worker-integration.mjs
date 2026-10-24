import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const wranglerRequire = createRequire(require.resolve('wrangler/package.json'));
const { Miniflare } = await import(pathToFileURL(wranglerRequire.resolve('miniflare')).href);
const root=fileURLToPath(new URL('../dist/server/',import.meta.url));
const files=(await readdir(root,{recursive:true})).filter(f=>/\.m?js$/.test(f));
files.sort((a,b)=>a==='index.js'?-1:b==='index.js'?1:a.localeCompare(b));
const mf = new Miniflare({
  modules: files.map(f=>({type:'ESModule',path:path.join(root,f)})),
  modulesRoot: root,
  compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],
  d1Databases:{DB:'jobsathi-test'},cf:false,
});
let checks=0;
try {
  const db=await mf.getD1Database('DB');
  const migration=await readFile(new URL('../drizzle/0000_nice_puma.sql',import.meta.url),'utf8');
  for(const sql of migration.split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean))await db.prepare(sql).run();
  async function request(path,method='GET',payload=undefined,user=undefined,expected=200){
    const headers={'content-type':'application/json'};
    if(user){headers['oai-authenticated-user-id']=user;headers['oai-authenticated-user-email']=`${user}@example.test`;}
    const response=await mf.dispatchFetch(`https://jobsathi.test${path}`,{method,headers,...(payload===undefined?{}:{body:JSON.stringify(payload)})});
    const text=await response.text(); let data;try{data=JSON.parse(text);}catch{throw new Error(`${method} ${path}: non-JSON ${response.status}: ${text.slice(0,300)}`);}
    assert.equal(response.status,expected,`${method} ${path}: ${JSON.stringify(data)}`);checks++;return data;
  }
  const employer='test-employer',candidate='test-candidate',stranger='test-stranger';
  const profile={name:'Synthetic Candidate',location:'Kothamangalam',targetRole:'Retail assistant',language:'Malayalam',experience:'I arranged products and collected payments in a family shop.',skills:'Arranging products',availability:'Day shift'};
  await request('/api/profile','PUT',{profile,confirmed:true},undefined,401);
  await request('/api/profile','PUT',{profile,confirmed:false},candidate,400);
  await request('/api/profile','PUT',{profile,confirmed:true},candidate);
  const draft={title:'Test Retail Assistant',company:'Synthetic Test Company',location:'Kothamangalam',category:'Retail',type:'Full-time',salaryMin:12000,salaryMax:15000,description:'Arrange products and help with everyday shop operations.',requirements:'Required: Malayalam communication. Preferred: billing experience.',shift:'Day shift',deadline:''};
  const job=(await request('/api/jobs','POST',draft,employer,201)).job;
  await request('/api/jobs','POST',{...draft,salaryMax:100},employer,400);
  await request('/api/jobs','POST',{...draft,deadline:'2020-01-01'},employer,400);
  await request('/api/jobs','PATCH',{id:job.id,status:'closed'},stranger,404);
  const apply={jobId:job.id,version:job.version,confirmed:true};
  const application=await request('/api/applications','POST',apply,candidate,201);
  await request('/api/applications','POST',apply,candidate,409);
  await request('/api/applications','PATCH',{id:application.id,status:'shortlisted'},stranger,403);
  const other=await request('/api/bootstrap','GET',undefined,stranger);
  assert.deepEqual(other.employerApplications,[]);assert.deepEqual(other.applications,[]);checks++;
  const owner=await request('/api/bootstrap','GET',undefined,employer);
  assert.ok(owner.employerApplications.some(a=>a.id===application.id));checks++;
  await request('/api/ai','POST',{action:'applicant',jobId:job.id,applicationId:application.id},stranger,403);
  await request('/api/applications','PATCH',{id:application.id,status:'shortlisted'},employer);
  await request('/api/profile','PUT',{profile:{...profile,experience:'This later edit must not change the submitted snapshot.'},confirmed:true},candidate);
  const candidateState=await request('/api/bootstrap','GET',undefined,candidate);
  assert.equal(candidateState.applications[0].snapshot.experience,profile.experience);checks++;
  await request('/api/jobs','PATCH',{id:job.id,status:'closed'},employer);
  const closed=await request('/api/bootstrap','GET',undefined,candidate);
  assert.ok(!closed.jobs.some(j=>j.id===job.id));checks++;
  await request('/api/profile','PUT',{profile,confirmed:true},stranger);
  await request('/api/applications','POST',apply,stranger,409);
  await request('/api/jobs','PATCH',{id:job.id,status:'active'},employer);
  await request('/api/applications','POST',apply,stranger,409);
  await request('/api/applications','PATCH',{id:application.id,status:'withdrawn'},candidate);
  await request('/api/applications','PATCH',{id:application.id,status:'shortlisted'},employer,409);
  const search=await request('/api/match','POST',{query:'retail',includeSamples:false},candidate);
  assert.equal(search.mode,'keyword');assert.ok(search.jobs.some(j=>j.id===job.id));checks++;
  await request('/api/ai','POST',{action:'extract',transcript:profile.experience,language:'English'},candidate,503);
  await request('/api/jobs','PATCH',{id:job.id,status:'closed'},employer);
  const origin=await mf.dispatchFetch('https://jobsathi.test/api/jobs',{method:'POST',headers:{origin:'https://other.test','content-type':'application/json','oai-authenticated-user-id':employer,'oai-authenticated-user-email':employer+'@example.test'},body:JSON.stringify(draft)});
  assert.equal(origin.status,403);checks++;
  console.log(`PASS: ${checks} Worker integration assertions. Real route handlers, isolated D1, separate identities. No external AI requests.`);
} finally { await mf.dispose(); }
