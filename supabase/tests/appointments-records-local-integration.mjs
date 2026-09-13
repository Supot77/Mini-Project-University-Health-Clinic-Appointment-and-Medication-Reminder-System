// Isolated PostgreSQL integration. No network, credentials or .env files.
// node supabase/tests/appointments-records-local-integration.mjs <absolute path to @electric-sql/pglite/dist/index.js>
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
const ids = Array.from({ length: 12 }, (_, n) => `00000000-0000-4000-8000-${String(n + 1).padStart(12, '0')}`);
const [patient, otherPatient, doctor, otherDoctor, staff, department, slot, otherSlot, medication] = ids;
let checks = 0;
async function query(sql, values) { return (await db.query(sql, values)).rows; }
async function as(user, sql, values) {
  await db.exec('SET ROLE authenticated');
  await query("SELECT set_config('request.jwt.claim.sub', $1, false)", [user]);
  try { return await query(sql, values); } finally { await db.exec('RESET ROLE'); }
}
async function denied(user, sql, values, pattern) {
  await assert.rejects(() => as(user, sql, values), pattern); checks++;
}
try {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA public, auth TO authenticated, anon;`);
  await db.exec(await readFile(new URL('../migrations/01_schema.sql', import.meta.url), 'utf8'));
  // Existing 02_rls.sql has malformed $func delimiters. Normalize only in this
  // isolated bootstrap; do not silently edit another owner's historical migration.
  const legacyRls = await readFile(new URL('../migrations/02_rls.sql', import.meta.url), 'utf8');
  await db.exec(legacyRls.replaceAll('$func', '$func$'));
  await db.exec('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;');
  const migration = await readFile(new URL('../migrations/13_pai_manual_appointments_records.sql', import.meta.url), 'utf8');
  await db.exec(migration);
  await db.exec(migration); // Reapplying the migration is safe.
  for (const [id, role, name] of [[patient,'patient','Patient A'],[otherPatient,'patient','Patient B'],[doctor,'medical','Doctor A'],[otherDoctor,'medical','Doctor B'],[staff,'staff_admin','Staff']]) {
    await query('INSERT INTO auth.users VALUES ($1)', [id]);
    await query('INSERT INTO profiles(id, role, full_name) VALUES ($1,$2,$3)', [id,role,name]);
  }
  await query("INSERT INTO departments(id,name) VALUES ($1,'Test')", [department]);
  for (const id of [doctor,otherDoctor]) await query('INSERT INTO doctors(id,department_id) VALUES ($1,$2)',[id,department]);
  for (const [s,d] of [[slot,doctor],[otherSlot,otherDoctor]]) await query("INSERT INTO appointment_slots(id,doctor_id,slot_date,start_time,end_time,max_capacity) VALUES ($1,$2,'2099-01-01','09:00','09:30',1)",[s,d]);
  await query("INSERT INTO medications(id,name,type,category,stock) VALUES ($1,'Test medicine','tablet','test',10)",[medication]);
  const booking = (await as(patient, 'SELECT pai_book_appointment($1,$2) AS id',[slot,'test']))[0].id;
  assert.equal((await query('SELECT booked_count FROM appointment_slots WHERE id=$1',[slot]))[0].booked_count,0); checks++;
  await denied(patient,'SELECT pai_book_appointment($1,$2)',[slot,'duplicate'],/มีนัด/);
  await denied(otherPatient,'SELECT pai_book_appointment($1,$2)',[slot,'full'],/เต็ม/);
  await denied(staff,'SELECT pai_book_appointment($1,$2)',[otherSlot,'role'],/เฉพาะผู้ป่วย/);
  await denied(patient,"UPDATE pai_appointments SET status='completed' WHERE id=$1",[booking],/permission denied/);
  assert.equal((await as(otherPatient,'SELECT * FROM pai_appointments')).length,0); checks++;
  assert.equal((await as(otherDoctor,'SELECT * FROM pai_appointments')).length,0); checks++;
  await denied(otherDoctor,'SELECT pai_transition_appointment($1,$2)',[booking,'in_progress'],/เฉพาะนัด/);
  await denied(patient,'SELECT pai_transition_appointment($1,$2)',[booking,'confirmed'],/ไม่มีสิทธิ์/);
  await as(staff,'SELECT pai_transition_appointment($1,$2)',[booking,'confirmed']);
  await as(doctor,'SELECT pai_transition_appointment($1,$2)',[booking,'in_progress']);
  await denied(doctor,'SELECT pai_transition_appointment($1,$2)',[booking,'completed'],/ผลตรวจ/);
  const invalid = [{ medication_id:medication, name:'fake', dosage:'test', frequency:'test', quantity:0, duration_days:1 }];
  await denied(doctor,'SELECT pai_save_record($1,$2,$3,$4,$5)',[booking,'Diagnosis','Advice',JSON.stringify(invalid),true],/กรุณากรอก/);
  assert.equal((await query('SELECT count(*)::int AS n FROM pai_medical_records'))[0].n,0); checks++;
  assert.equal((await query('SELECT status FROM pai_appointments WHERE id=$1',[booking]))[0].status,'in_progress'); checks++;
  const prescriptions = [{ ...invalid[0], quantity:2 }];
  await denied(otherDoctor,'SELECT pai_save_record($1,$2,$3,$4,$5)',[booking,'Diagnosis','Advice',JSON.stringify(prescriptions),true],/นัดของตน/);
  await denied(staff,'SELECT pai_save_record($1,$2,$3,$4,$5)',[booking,'Diagnosis','Advice','[]',true],/เฉพาะแพทย์/);
  await as(doctor,'SELECT pai_save_record($1,$2,$3,$4,$5)',[booking,'Diagnosis','Advice',JSON.stringify(prescriptions),false]);
  assert.equal((await as(patient,'SELECT * FROM pai_medical_records')).length,0); checks++;
  assert.equal((await as(staff,'SELECT * FROM pai_medical_records')).length,0); checks++;
  assert.equal((await as(otherDoctor,'SELECT * FROM pai_medical_records')).length,0); checks++;
  await denied(doctor,'SELECT pai_save_record($1,$2,$3,$4,$5)',[booking,'Changed','Advice','[]',false],/บันทึกผลตรวจแล้ว/);
  await denied(doctor,"UPDATE pai_medical_records SET diagnosis='changed'",[],/permission denied/);
  await as(staff,'SELECT pai_transition_appointment($1,$2)',[booking,'completed']);
  const records = await as(patient,'SELECT * FROM pai_medical_records');
  assert.equal(records.length,1); assert.equal(records[0].prescribed_medications[0].name,'Test medicine'); checks++;
  assert.equal((await as(otherPatient,'SELECT * FROM pai_medical_records')).length,0); checks++;
  const staffSnapshot = (await as(staff,'SELECT pai_workspace() AS snapshot'))[0].snapshot;
  assert.deepEqual(staffSnapshot.records,[]); assert.deepEqual(staffSnapshot.medications,[]); checks++;
  const patientSnapshot = (await as(patient,'SELECT pai_workspace() AS snapshot'))[0].snapshot;
  assert.equal(patientSnapshot.records.length,1); assert.equal(patientSnapshot.actor.id,patient); checks++;
  const nextBooking = (await as(patient,'SELECT pai_book_appointment($1,$2) AS id',[otherSlot,'test']))[0].id;
  await as(patient,'SELECT pai_transition_appointment($1,$2)',[nextBooking,'request_cancel']);
  assert.equal((await query('SELECT booked_count FROM appointment_slots WHERE id=$1',[otherSlot]))[0].booked_count,0); checks++;
  await query("UPDATE appointment_slots SET status='closed' WHERE id=$1",[otherSlot]);
  await as(staff,'SELECT pai_transition_appointment($1,$2)',[nextBooking,'cancelled']);
  assert.deepEqual((await query('SELECT status,booked_count FROM appointment_slots WHERE id=$1',[otherSlot]))[0],{status:'closed',booked_count:0}); checks++;
  await denied(staff,'SELECT pai_transition_appointment($1,$2)',[nextBooking,'cancelled'],/สถานะ/);
  assert.equal((await query('SELECT stock FROM medications WHERE id=$1',[medication]))[0].stock,10); checks++;
  await query('UPDATE profiles SET is_active=false WHERE id=$1',[patient]);
  await denied(patient,'SELECT pai_workspace()',[],/เข้าสู่ระบบ/);
  console.log(`PASS: ${checks} PostgreSQL assertions; migration reapplied; RLS, ownership, rollback, manual cancellation, pharmacy JSON; no remote database used.`);
} catch (error) {
  console.error('FAIL:', error.message, 'code:', error.code ?? '', 'context:', error.where ?? '');
  process.exitCode = 1;
} finally { await db.close(); }
