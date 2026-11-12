// PostgreSQL reserves the literal pg_ role prefix. Do not use SQL LIKE pg_%,
// whose underscore wildcard would also accept user-controlled pgcustom names.
export const isBuiltinRole = name => name === 'postgres' || typeof name === 'string' && name.startsWith('pg_')
export const isBuiltinSchema = name => ['public','pg_catalog','information_schema','pg_toast'].includes(name) || typeof name === 'string' && /^(pg_temp_[0-9]+|pg_toast_temp_[0-9]+)$/.test(name)
