import test from 'node:test';
import assert from 'node:assert/strict';
import { cosine, filterJobs, isCurrent, keywordScore, tokens } from '../app/lib/matching.ts';
import type { Job } from '../app/lib/types.ts';
const base:Job={id:'a',title:'Retail Assistant',company:'Test',location:'Kothamangalam',category:'Retail',type:'Full-time',salaryMin:12000,salaryMax:15000,description:'Arrange products and assist customers',requirements:'Basic Malayalam communication',shift:'Day',deadline:'',status:'active',version:1,createdAt:'',updatedAt:''};

test('closed and expired vacancies are excluded',()=>{
  assert.equal(isCurrent({...base,status:'closed'}),false);
  assert.equal(isCurrent({...base,deadline:'2020-01-01'}),false);
  assert.equal(isCurrent({...base,deadline:'2026-10-24'},'2026-10-24'),true);
});
test('explicit filters and sample visibility are respected',()=>{
  const result=filterJobs([base,{...base,id:'b',sample:true},{...base,id:'c',location:'Kochi'}],{location:'kothamangalam',includeSamples:false});
  assert.deepEqual(result.map(j=>j.id),['a']);
  assert.equal(filterJobs([base],{category:'Delivery'}).length,0);
});
test('unknown deadline does not fabricate an expiry',()=>assert.equal(isCurrent(base),true));
test('keyword baseline prefers title overlap and returns zero for unrelated words',()=>{
  assert.ok(keywordScore('retail',base)>keywordScore('customers',base));
  assert.equal(keywordScore('astronaut',base),0);
});
test('Malayalam tokens are retained without claiming translation',()=>assert.ok(tokens('മലയാളത്തിൽ ജോലി').length>0));
test('cosine similarity is not converted into hiring probability',()=>{
  assert.equal(cosine([1,0],[1,0]),1);assert.equal(cosine([1,0],[0,1]),0);
  assert.equal(cosine([0,0],[1,0]),0);assert.equal(cosine([1],[1,0]),0);
});
