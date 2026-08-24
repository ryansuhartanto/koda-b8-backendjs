import { Sequelize } from "@sequelize/core";

import options from "#/lib/options";

export const sequelize: Sequelize = new Sequelize(options);

// BIGINT and NUMERIC arrive as strings; every value here fits in 2^53
sequelize.dialect.registerDataTypeParser(["int8", "numeric"], Number);

// sequelize wraps driver errors, so the SQLSTATE sits one level down
export function sqlstate(error: unknown): string | undefined {
	return (error as { cause?: { code?: string } }).cause?.code;
}
