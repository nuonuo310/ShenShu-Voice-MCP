import {test} from "node:test";
import assert from "node:assert/strict";
import {createPostgresGrantStore,POSTGRES_GRANT_SQL} from "../src/postgres-grant-store.js";
const args={grantId:"grant_12345678",requestId:"request_123456",subject:"owner_12345"};
function fixture({issueRows=1,consumeRows=1,fail=false}={}) {
  const calls=[];let released=0;
  const client={async query(sql,params){
    calls.push({sql,params});
    if(fail)throw Error("db");
    if(sql===POSTGRES_GRANT_SQL.issue)return {rowCount:issueRows};
    if(sql===POSTGRES_GRANT_SQL.consume)return {rowCount:consumeRows};
    throw Error("unexpected_sql");
  },release(){released++;}};
  return {pool:{connect:async()=>client},calls,get released(){return released}};
}
test("issue once and consume once using parameterized SQL",async()=>{
  const f=fixture();const store=createPostgresGrantStore({pool:f.pool});
  assert.deepEqual(await store.issue(args),{issued:true});
  assert.deepEqual(await store.consume(args),{consumed:true});
  assert.equal(f.released,2);
  assert.deepEqual(f.calls[0].params,[args.grantId,args.requestId,args.subject]);
});
test("duplicate issue and replayed consume fail closed",async()=>{
  const i=fixture({issueRows:0});assert.deepEqual(await createPostgresGrantStore({pool:i.pool}).issue(args),{issued:false});
  const c=fixture({consumeRows:0});assert.deepEqual(await createPostgresGrantStore({pool:c.pool}).consume(args),{consumed:false});
});
test("database failure and invalid values fail closed",async()=>{
  const f=fixture({fail:true});const store=createPostgresGrantStore({pool:f.pool});
  await assert.rejects(()=>store.issue(args),/grant_store_unavailable/);
  await assert.rejects(()=>store.consume(args),/grant_store_unavailable/);
  let count=0;
  const strict=createPostgresGrantStore({pool:{connect:async()=>{count++;throw Error("no");}}});
  await assert.rejects(()=>strict.issue({...args,grantId:"x"}),/invalid_grant/);
  await assert.rejects(()=>strict.consume({...args,subject:"bad"}),/invalid_grant/);
  assert.equal(count,0);
});
test("consume SQL is state-conditional and never reusable",()=>{
  assert.match(POSTGRES_GRANT_SQL.consume,/state = 'issued'/);
  assert.match(POSTGRES_GRANT_SQL.consume,/state = 'consumed'/);
  assert.match(POSTGRES_GRANT_SQL.issue,/ON CONFLICT DO NOTHING/);
});
