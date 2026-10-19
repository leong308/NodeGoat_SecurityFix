const test=require("node:test"),assert=require("node:assert/strict");const Handler=require("../app/routes/profile");
test("V09 long hostile routing input and non-string fields reject before DB work",()=>{
 let called=false;const handler=new Handler({collection:()=>({update:()=>{called=true;}})});
 for(const routing of ["9".repeat(10000)+"X",{},"123"]){
  const body={firstName:"A",lastName:"B",ssn:"",dob:"",address:"",bankAcc:"",bankRouting:routing,website:""};
  handler.handleProfileUpdate({body,session:{userId:2}},{status(c){assert.equal(c,400);return this;},render(){}},()=>assert.fail());
 }assert.equal(called,false);
});
