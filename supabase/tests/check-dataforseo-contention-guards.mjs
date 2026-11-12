import assert from 'node:assert/strict'
import {isBuiltinRole,isBuiltinSchema} from './dataforseo-contention-guards.mjs'
for(const name of ['postgres','pg_read_all_data','pg_monitor'])assert.equal(isBuiltinRole(name),true,name)
for(const name of ['pgcustom','pgXsuper','pg','app','pg-admin','Postgres'])assert.equal(isBuiltinRole(name),false,name)
for(const name of ['public','pg_catalog','information_schema','pg_toast','pg_temp_1','pg_toast_temp_22'])assert.equal(isBuiltinSchema(name),true,name)
for(const name of ['pg_toast_evil','pg_toast_temp_evil','pg_temp_fake','pg_tempX1','pg_toast2','pg_temp_1_evil','app'])assert.equal(isBuiltinSchema(name),false,name)
console.log('PASS pristine-cluster lookalike role/schema regression checks; no database connection')
