const https = require('https');
const KEY = 'sb_publishable_jendduWuZEGXMLjPeGRB1g__KY4wBN4';

function tryInsert(table, obj) {
  return new Promise(function(resolve) {
    const body = JSON.stringify(obj);
    const req = https.request({
      hostname: 'eositsyqjxjgcnopmpax.supabase.co',
      path: '/rest/v1/' + table,
      method: 'POST',
      headers: {
        'apikey': KEY,
        'Authorization': 'Bearer ' + KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, function(r) {
      let d = '';
      r.on('data', function(c) { d += c; });
      r.on('end', function() { resolve(d.slice(0, 200)); });
    });
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('--- users table columns ---');
  const userCols = ['full_name','name','display_name','fullname','first_name','last_name','fname','lname','username','email','password_hash','password','is_active','active','status','role','created_at','locked_until','failed_login_attempts','id','user_id','profile_pic','avatar','phone','address'];
  for (let i = 0; i < userCols.length; i++) {
    const c = userCols[i];
    const r = await tryInsert('users', {[c]: 'test'});
    const missing = r.indexOf('Could not find') !== -1;
    console.log((missing ? '  ✗' : '  ✓') + ' ' + c + (missing ? '' : ' <= EXISTS') + (missing ? '' : '  => ' + r.slice(0,80)));
  }

  console.log('--- files table columns ---');
  const fileCols = ['user_id','filename','file_url','file_size','size','mimetype','mime_type','status','created_at'];
  for (let i = 0; i < fileCols.length; i++) {
    const c = fileCols[i];
    const r = await tryInsert('files', {[c]: 'test'});
    const missing = r.indexOf('Could not find') !== -1;
    console.log((missing ? '  ✗' : '  ✓') + ' ' + c + (missing ? '' : ' <= EXISTS'));
  }
}

main().catch(console.error);
