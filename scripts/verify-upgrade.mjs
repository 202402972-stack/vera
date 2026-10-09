// Reproduce a legacy platform data set using the requested git revision, then upgrade a disposable copy.
import {
  mkdtempSync,
  mkdirSync,
  symlinkSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
const root = process.cwd(),
  baseRef = process.argv[2] || "a4e0279",
  temporary = mkdtempSync(path.join(os.tmpdir(), "vera-upgrade-")),
  old = path.join(temporary, "old"),
  data = path.join(temporary, "data");
mkdirSync(old);
const command = (cmd, args, options = {}) => {
  const r = spawnSync(cmd, args, {
    cwd: root,
    encoding: "utf8",
    timeout: 30000,
    ...options,
  });
  if (r.status !== 0) throw Error(cmd + " failed: " + r.stderr);
  return r.stdout;
};
try {
  command("git", [
    "archive",
    baseRef,
    "--output=" + path.join(temporary, "source.tar"),
  ]);
  command("tar", ["-xf", path.join(temporary, "source.tar"), "-C", old]);
  symlinkSync(
    path.join(root, "node_modules"),
    path.join(old, "node_modules"),
    "dir",
  );
  const fixture = `await import('./server/platform/app.js');const core=await import('./server/platform/core.js'),db=await import('./server/db.js'),{inTenant}=await import('./server/tenant.js');core.sql('INSERT INTO platform_users(sub,email,name,created) VALUES(?,?,?,?)').run('upgrade-owner','upgrade@fixture.test','Upgrade merchant',Date.now());const user=core.sql('SELECT * FROM platform_users').get();const s=core.provision(user,{name:'Legacy custom boutique',slug:'legacy-upgrade',template:'atelier',password:'legacy-custom-password-123'});core.sql('UPDATE platform_stores SET paused=1,trial_until=0,access_until=0 WHERE id=?').run(s.id);inTenant(s.id,s.url,()=>{const p=db.productsAll()[0];p.title='Custom untouched product';db.writeProduct(p);db.stmt('INSERT INTO orders(number,token,idempotency_key,created_at,data) VALUES(?,?,?,?,?)').run('OLD-1','historic-token','historic-key',new Date().toISOString(),JSON.stringify({currency:'USD',total_in_cents:10000,items:[{title:'Prior purchase'}]}));});const snapshot={id:s.id,products:inTenant(s.id,s.url,()=>db.productsAll()),orders:inTenant(s.id,s.url,()=>db.stmt('SELECT data FROM orders').all()),password:inTenant(s.id,s.url,()=>db.getSetting('password_fingerprint'))};console.log(JSON.stringify(snapshot));db.rawDb.close();`;
  const environment = {
    ...process.env,
    DATA_DIR: data,
    PLATFORM_MODE: "1",
    NODE_ENV: "test",
    OWNER_EMAILS: "upgrade@fixture.test",
  };
  const before = JSON.parse(
    command(process.execPath, ["--input-type=module", "-e", fixture], {
      cwd: old,
      env: environment,
    }),
  );
  writeFileSync(path.join(temporary, "before.json"), JSON.stringify(before));
  const verification = `await import('./server/platform/app.js');const core=await import('./server/platform/core.js'),db=await import('./server/db.js'),{inTenant}=await import('./server/tenant.js');const s=core.sql("SELECT * FROM platform_stores WHERE slug='legacy-upgrade'").get();console.log(JSON.stringify({id:s.id,publication:s.publication_state,paused:s.paused,trial:s.trial_until,access:s.access_until,products:inTenant(s.id,'/s/'+s.slug,()=>db.productsAll()),orders:inTenant(s.id,'/s/'+s.slug,()=>db.stmt('SELECT data FROM orders').all()),password:inTenant(s.id,'/s/'+s.slug,()=>db.getSetting('password_fingerprint')),migrations:core.sql('SELECT count(*) n FROM platform_schema_migrations').get().n}));db.rawDb.close();`;
  const after = JSON.parse(
    command(process.execPath, ["--input-type=module", "-e", verification], {
      env: environment,
    }),
  );
  assert.deepEqual(after.products, before.products);
  assert.deepEqual(after.orders, before.orders);
  assert.equal(after.password, before.password);
  assert.equal(after.publication, "published");
  assert.equal(after.paused, 1);
  assert.equal(after.trial, 0);
  assert.equal(after.access, 0);
  assert.equal(after.id, before.id);
  assert.equal(after.migrations, 4);
  console.log(
    JSON.stringify({
      ok: true,
      baseRef,
      productsPreserved: after.products.length,
      ordersPreserved: after.orders.length,
      passwordPreserved: true,
      pausedExpiredStatePreserved: true,
      migrations: after.migrations,
    }),
  );
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
