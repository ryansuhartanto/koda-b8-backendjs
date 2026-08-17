import { Pool, types } from "pg";

// pg returns BIGINT and NUMERIC as strings; every value here fits in 2^53
types.setTypeParser(types.builtins.INT8, Number);
types.setTypeParser(types.builtins.NUMERIC, Number);

// pg reads PG* from the environment
export const pool: Pool = new Pool();
