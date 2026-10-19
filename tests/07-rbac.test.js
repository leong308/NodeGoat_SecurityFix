const test=require("node:test"),assert=require("node:assert/strict");
const Session=require("../app/routes/session");
test("V07 employee role cannot invoke admin middleware; admin passes",()=>{
 for(const isAdmin of [false,true]){
  const handler=new Session({collection:()=>({findOne:(q,cb)=>cb(null,{isAdmin})})});let passed=false,denied=false;
  handler.isAdminUserMiddleware({session:{userId:2}},{status(c){assert.equal(c,403);return this;},send(){denied=true;}},()=>{passed=true;});
  assert.equal(passed,isAdmin);assert.equal(denied,!isAdmin);
 }
});
