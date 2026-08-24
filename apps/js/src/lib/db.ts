import { Pool, types } from "pg";
import type { PoolClient } from "pg";

// pg returns BIGINT and NUMERIC as strings; every value here fits in 2^53
types.setTypeParser(types.builtins.INT8, Number);
types.setTypeParser(types.builtins.NUMERIC, Number);

// pg reads PG* from the environment
export const pool: Pool = new Pool();

export async function transact<T>(
	fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
	const client = await pool.connect();

	try {
		await client.query("BEGIN");
		const result = await fn(client);
		await client.query("COMMIT");

		return result;
	} catch (error) {
		await client.query("ROLLBACK");
		throw error;
	} finally {
		client.release();
	}
}
