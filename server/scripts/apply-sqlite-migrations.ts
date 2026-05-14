import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const applyMigrations = async () => {
	await prisma.$executeRawUnsafe(`
		CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
			"id" TEXT NOT NULL PRIMARY KEY,
			"appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		);
	`);

	const appliedMigrations = await prisma.$queryRaw<Array<{ id: string }>>`
		SELECT "id" FROM "_prisma_migrations"
	`;
	const appliedMigrationIds = new Set(appliedMigrations.map((migration) => migration.id));
	const migrationsPath = path.resolve("prisma", "migrations");
	const entries = await readdir(migrationsPath, { withFileTypes: true });
	const migrationDirectories = entries
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort((left, right) => left.localeCompare(right));

	for (const directory of migrationDirectories) {
		if (appliedMigrationIds.has(directory)) {
			continue;
		}

		const migrationPath = path.join(migrationsPath, directory, "migration.sql");
		const migration = await readFile(migrationPath, "utf8");
		const statements = migration
			.split(/;\s*(?:\r?\n|$)/)
			.map((statement) => statement.trim())
			.filter(Boolean);

		for (const statement of statements) {
			await prisma.$executeRawUnsafe(statement);
		}

		await prisma.$executeRaw`
			INSERT INTO "_prisma_migrations" ("id") VALUES (${directory})
		`;
	}
};

applyMigrations()
	.finally(async () => {
		await prisma.$disconnect();
	})
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	});
