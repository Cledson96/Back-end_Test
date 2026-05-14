import type { PrismaClient } from "@prisma/client";
import type { SqrtCalculationResponse, SqrtHistoryResponse } from "@shared/types";

import { prisma } from "@/common/database/prisma";

type CreateCalculationInput = {
	input: number;
	result: number;
};

type FindManyCalculationsInput = {
	limit: number;
	cursor?: string;
};

type CalculationRecord = {
	id: string;
	input: number;
	result: number;
	createdAt: Date;
};

export class CalculationRepository {
	constructor(private readonly database: PrismaClient = prisma) {}

	async create(data: CreateCalculationInput): Promise<SqrtCalculationResponse> {
		const calculation = await this.database.calculation.create({
			data,
		});

		return toCalculationResponse(calculation);
	}

	async findMany({ limit, cursor }: FindManyCalculationsInput): Promise<SqrtHistoryResponse> {
		const calculations = await this.database.calculation.findMany({
			take: limit + 1,
			skip: cursor ? 1 : 0,
			cursor: cursor ? { id: cursor } : undefined,
			orderBy: [{ createdAt: "desc" }, { id: "desc" }],
		});
		const pageItems = calculations.slice(0, limit);
		const nextCursor = calculations.length > limit ? pageItems.at(-1)?.id : undefined;

		return {
			items: pageItems.map(toCalculationResponse),
			nextCursor,
		};
	}

	async deleteAll(): Promise<number> {
		const result = await this.database.calculation.deleteMany();

		return result.count;
	}
}

const toCalculationResponse = (calculation: CalculationRecord): SqrtCalculationResponse => ({
	id: calculation.id,
	input: calculation.input,
	result: calculation.result,
	createdAt: calculation.createdAt.toISOString(),
});
