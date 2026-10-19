const test=require("node:test"),assert=require("node:assert/strict");const csrf=require("../app/lib/csrf");
test("V08 absent/wrong tokens deny POST and valid session token passes",()=>{
 const req={session:{},method:"GET"},res={locals:{},status(c){assert.equal(c,403);return this;},send(){}};let passed=0;
 csrf(req,res,()=>passed++);assert.equal(req.session.csrf.length,64);
 req.method="POST";req.body={};csrf(req,res,()=>assert.fail());
 req.body._csrf="0".repeat(64);csrf(req,res,()=>assert.fail());
 req.body._csrf=req.session.csrf;csrf(req,res,()=>passed++);assert.equal(passed,2);
});
