// (01) explicit seed command for creating demo data.
// (01)  Normal server startup no longer calls the old script to deletes and recreates application records.
"use strict";
// (01) Load the database driver and same connection setting as the server
const {MongoClient}=require("mongodb");
const {db}=require("../config/config");
async function main() {
 const client=await MongoClient.connect(db);
 // (01) finally below closes the connection if a step fails or returns early
 try {
  const database=client.db(), users=database.collection("users");
  // (01) Stop without changing records if any user exists
  if(await users.countDocuments()){console.log("Seed skipped: users already exist; data preserved.");return;}

  // (01) Build three demo records with fixed IDs and passwords from the environment.
  // (01) hashing is implemented separately in Fix 05.
  const fixtures=[
   {_id:1,userName:"admin",firstName:"Demo",lastName:"Administrator",isAdmin:true,password:process.env.ADMIN_PASSWORD},
   {_id:2,userName:"user1",firstName:"Alice",lastName:"Employee",isAdmin:false,password:process.env.USER1_PASSWORD},
   {_id:3,userName:"user2",firstName:"Bob",lastName:"Employee",isAdmin:false,password:process.env.USER2_PASSWORD}
  ];
  // (01) Detects whether any password is missing or shorter than 15 characters
  // (01) Refuse to seed in if condition is true
  if(fixtures.some(u=>typeof u.password!=="string" || u.password.length<15)) throw Error("Set three demo passwords of at least 15 characters in .env.");
  // (01) username index used for lookups, then insert into collection
  await users.createIndex({userName:1},{unique:true});
  await users.insertMany(fixtures);
  // (01) Start the user-ID counter
  await database.collection("counters").insertOne({_id:"userId",seq:3});
  // (01) map builds an initial investment allocation for each user
  await database.collection("allocations").insertMany(fixtures.map(u=>({userId:u._id,stocks:30,funds:30,bonds:40})));
  // (01) Confirm success into console
  console.log("Seeded admin, user1, user2. No passwords printed.");
 // (01) Release the connection
 } finally {await client.close();}
}
// (01) Report a seed error and set exit code 1
main().catch(e=>{console.error(e.message);process.exitCode=1;});
