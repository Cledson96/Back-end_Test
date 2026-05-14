import type { ImportFile, PrismaClient } from "@prisma/client";
import type { SqrtCalculationResponse, SqrtHistoryResponse } from "@shared/types";

import { prisma } from "@/common/database/prisma";

type CreateCalculationInput = {
	input: number;
	result: number;
	importFileId?: string;
	sourceRowNumber?: number;
};

type CreateImportedCalculationsInput = {
	importFile: {
		originalName: string;
		storedName: string;
		storagePath: string;
		mimeType: string;
		sizeBytes: number;
		rowCount: number;
	};
	calculations: Array<{
		input: number;
		result: number;
		sourceRowNumber: number;
	}>;
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
	sourceRowNumber: number | null;
	importFile: Pick<ImportFile, "id" | "originalName"> | null;
};

const calculationInclude = {
	importFile: {
		select: {
			id: true,
			originalName: true,
		},
	},
};

export class CalculationRepository {
	constructor(private readonly database: PrismaClient = prisma) {}

	async create(data: CreateCalculationInput): Promise<SqrtCalculationResponse> {
		const calculation = await this.database.calculation.create({
			data,
			include: calculationInclude,
		});

		return toCalculationResponse(calculation);
	}

	async createImported({ importFile, calculations }: CreateImportedCalculationsInput) {
		return this.database.$transaction(async (transaction) => {
			const createdImportFile = await transaction.importFile.create({
				data: importFile,
			});
			const createdCalculations = [];

			for (const calculation of calculations) {
				createdCalculations.push(
					await transaction.calculation.create({
						data: {
							input: calculation.input,
							result: calculation.result,
							sourceRowNumber: calculation.sourceRowNumber,
							importFileId: createdImportFile.id,
						},
						include: calculationInclude,
					}),
				);
			}

			return {
				importFile: createdImportFile,
				calculations: createdCalculations.map(toCalculationResponse),
			};
		});
	}

	async findMany({ limit, cursor }: FindManyCalculationsInput): Promise<SqrtHistoryResponse> {
		const calculations = await this.database.calculation.findMany({
			take: limit + 1,
			skip: cursor ? 1 : 0,
			cursor: cursor ? { id: cursor } : undefined,
			include: calculationInclude,
			orderBy: [{ createdAt: "desc" }, { id: "desc" }],
		});
		const pageItems = calculations.slice(0, limit);
		const nextCursor = calculations.length > limit ? pageItems.at(-1)?.id : undefined;

		return {
			items: pageItems.map(toCalculationResponse),
			nextCursor,
		};
	}

	async findAll(): Promise<SqrtCalculationResponse[]> {
		const calculations = await this.database.calculation.findMany({
			include: calculationInclude,
			orderBy: [{ createdAt: "desc" }, { id: "desc" }],
		});

		return calculations.map(toCalculationResponse);
	}

	async findImportFileById(id: string): Promise<ImportFile | null> {
		return this.database.importFile.findUnique({
			where: { id },
		});
	}

	async findImportFiles(): Promise<ImportFile[]> {
		return this.database.importFile.findMany();
	}

	async deleteAll(): Promise<number> {
		const result = await this.database.$transaction(async (transaction) => {
			const deletedCalculations = await transaction.calculation.deleteMany();

			await transaction.importFile.deleteMany();

			return deletedCalculations;
		});

		return result.count;
	}
}

const toCalculationResponse = (calculation: CalculationRecord): SqrtCalculationResponse => ({
	id: calculation.id,
	input: calculation.input,
	result: calculation.result,
	createdAt: calculation.createdAt.toISOString(),
	sourceFileId: calculation.importFile?.id,
	sourceFileName: calculation.importFile?.originalName,
	sourceRowNumber: calculation.sourceRowNumber ?? undefined,
});
