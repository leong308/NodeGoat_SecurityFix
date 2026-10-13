// (01) Test the upgrade's database write translation using Node's built-in tools.
"use strict";
// (01) test defines a check; assert compares actual results with our expectations.
const test=require("node:test"),assert=require("node:assert/strict");
const compat=require("../app/lib/mongo-compat");
// (01) This unit test checks the adapter without requiring a real MongoDB server.
test("V01 modern Mongo compatibility translates replacement and modifier writes",async()=>{
 const calls=[];const c={replaceOne:async(...args)=>{calls.push(["replace",...args]);return {};},updateOne:async(...args)=>{calls.push(["update",...args]);return {};}};
 // (01) The fake collection above records whether replaceOne or updateOne is used.
 // (01) Supply it to the adapter in place of a real database collection.
 const collection=compat({collection:()=>c}).collection("users");
 // (01) A plain document must select replaceOne. Wait for its callback so the
 // (01) assertion cannot run before the asynchronous operation finishes.
 await new Promise((resolve,reject)=>collection.update({_id:1},{firstName:"A"},{upsert:true},e=>e?reject(e):resolve()));
 // (01) A $set document must select updateOne; omit options to also exercise the
 // (01) legacy three-argument update(filter,data,callback) form.
 await new Promise((resolve,reject)=>collection.update({_id:1},{$set:{firstName:"B"}},e=>e?reject(e):resolve()));
 // (01) Fail if either operation selected the wrong method. This proves method
 // (01) selection only; other adapter methods and real persistence need other checks.
 assert.equal(calls[0][0],"replace");assert.equal(calls[1][0],"update");
});
