import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/common/database/prisma";
import { CalculationRepository } from "../calculation.repository";

describe("CalculationRepository", () => {
	const repository = new CalculationRepository(prisma);

	beforeEach(async () => {
		await prisma.calculation.deleteMany();
	});

	afterAll(async () => {
		await prisma.calculation.deleteMany();
		await prisma.$disconnect();
	});

	it("creates a calculation record", async () => {
		const calculation = await repository.create({ input: 9, result: 3 });

		expect(calculation).toMatchObject({
			input: 9,
			result: 3,
		});
		expect(calculation.id).toEqual(expect.any(String));
		expect(new Date(calculation.createdAt).toString()).not.toBe("Invalid Date");
	});

	it("returns cursor-paginated history ordered by newest first", async () => {
		const first = await repository.create({ input: 4, result: 2 });
		const second = await repository.create({ input: 9, result: 3 });
		const third = await repository.create({ input: 16, result: 4 });

		const firstPage = await repository.findMany({ limit: 2 });
		const secondPage = await repository.findMany({ limit: 2, cursor: firstPage.nextCursor });

		expect(firstPage).toEqual({
			items: [
				expect.objectContaining({ id: third.id }),
				expect.objectContaining({ id: second.id }),
			],
			nextCursor: second.id,
		});
		expect(secondPage).toEqual({
			items: [expect.objectContaining({ id: first.id })],
			nextCursor: undefined,
		});
	});

	it("deletes all calculation records", async () => {
		await repository.create({ input: 25, result: 5 });
		await repository.create({ input: 36, result: 6 });

		const deletedCount = await repository.deleteAll();
		const history = await repository.findMany({ limit: 10 });

		expect(deletedCount).toBe(2);
		expect(history.items).toHaveLength(0);
	});
});
