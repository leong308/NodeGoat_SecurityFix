// (01) Strict mode helps catch mistakes in this new compatibility module.
"use strict";
// (01) An adapter translates between interfaces. Existing NodeGoat DAOs expect
// (01) old MongoDB methods and callbacks; driver 6 uses newer methods and Promises.
// (01) Translate only the operations this application needs.
module.exports = function legacyDatabase(db) {
  // (01) Keep db.collection(name): a collection groups records such as users.
  // (01) c is the real collection obtained from the modern MongoDB driver.
  return { collection(name) {
    const c=db.collection(name);
    // (01) A Promise represents a result that arrives later. Convert success into
    // (01) cb(null, result) and failure into cb(error), the old callback convention.
    // (01) transform can reshape the result; x=>x means leave it unchanged.
    // (01) This translates results; it does not sanitize database queries or data.
    const call=(promise,cb,transform=x=>x)=>promise.then(x=>cb(null,transform(x)),e=>cb(e));
    return {
      // (01) find creates a cursor (a way to read matching records). The wrapper
      // (01) preserves chained sort(...).toArray(callback) calls used by old DAOs.
      find(query) {
        const cursor=c.find(query);
        // (01) sort changes record order and returns the wrapper for chaining;
        // (01) toArray collects records and delivers them to the old callback.
        const wrapper={sort(s){cursor.sort(s);return wrapper;},toArray(cb){call(cursor.toArray(),cb);}};
        return wrapper;
      },
      // (01) Find one matching record and deliver it through a callback.
      findOne(query,cb){call(c.findOne(query),cb);},
      // (01) Replace removed insert with insertOne. Old user creation reads
      // (01) result.ops[0], so return the inserted document in that old result shape.
      insert(doc,cb){call(c.insertOne(doc),cb,()=>({ops:[doc]}));},
      // (01) filter selects a record; update contains new data; options can include
      // (01) upsert, meaning create a record if no existing record matches.
      update(filter,update,options,cb){
        // (01) Support both forms: update(filter,data,callback) and
        // (01) update(filter,data,options,callback). Use empty options if omitted.
        if(typeof options === "function"){cb=options;options={};}
        // (01) A key beginning with $ marks an update operator, such as $set to
        // (01) change selected fields: use updateOne. A plain document replaces
        // (01) the record: use replaceOne. Choosing correctly preserves legacy writes.
        const operation=Object.keys(update).some(k=>k.startsWith("$")) ? c.updateOne(filter,update,options) : c.replaceOne(filter,update,options);
        // (01) Deliver the write result or error using the legacy callback convention.
        call(operation,cb);
      },
      // (01) Map findAndModify to findOneAndUpdate for the user-ID counter. Return
      // (01) the updated record, create if absent, and wrap it as {value} because
      // (01) the old caller reads result.value. This narrow mapping ignores the old
      // (01) sort/options arguments; it is not a general-purpose legacy adapter.
      findAndModify(filter,sort,update,options,cb){call(c.findOneAndUpdate(filter,update,{returnDocument:"after",upsert:true}),cb,value=>({value}));}
    };
  }};
};
