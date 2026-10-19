const test=require("node:test"),assert=require("node:assert/strict");
const Handler=require("../app/routes/allocations");
test("V06 other user's allocation URL is denied before database access",()=>{
 let called=false;const db={collection:()=>({find:()=>{called=true;}})};
 const handler=new Handler(db),response={status(code){assert.equal(code,403);return this;},send(message){assert.equal(message,"Access denied.");}};
 handler.displayAllocations({session:{userId:2},params:{userId:"3"},query:{}},response,()=>assert.fail());assert.equal(called,false);
});
