import { unlink } from "node:fs/promises";

import type {
	SqrtCalculationResponse,
	SqrtClearHistoryResponse,
	SqrtHistoryImportResponse,
	SqrtHistoryResponse,
} from "@shared/types";

import { CalculationRepository } from "./calculation.repository";
import {
	ExcelHistoryService,
	type UploadedExcelFile,
	getDownloadFileName,
	getStoredFileName,
} from "./excel-history.service";
import { calculateSquareRootInWorker, calculateSquareRootsInWorker } from "./square-root.worker-runner";

type FindHistoryInput = {
	limit: number;
	cursor?: string;
};

export class SquareRootService {
	private readonly cache = new Map<number, number>();

	constructor(
		private readonly calculationRepository = new CalculationRepository(),
		private readonly excelHistoryService = new ExcelHistoryService(),
	) {}

	async calculate(input: number): Promise<SqrtCalculationResponse> {
		const result = await this.getResult(input);

		return this.calculationRepository.create({ input, result });
	}

	async findHistory(input: FindHistoryInput): Promise<SqrtHistoryResponse> {
		return this.calculationRepository.findMany(input);
	}

	async exportHistory() {
		const calculations = await this.calculationRepository.findAll();
		const workbook = await this.excelHistoryService.buildHistoryWorkbook(calculations);

		return {
			fileName: getDownloadFileName(),
			workbook,
		};
	}

	async importHistory(file: UploadedExcelFile): Promise<SqrtHistoryImportResponse> {
		const parsedImport = await this.excelHistoryService.parseImportFile(file);

		if (parsedImport.validRows.length === 0) {
			await removeFileIfExists(file.path);

			return {
				importId: "",
				fileName: file.originalname,
				totalRows: parsedImport.totalRows,
				createdCount: 0,
				failedCount: parsedImport.errors.length,
				errors: parsedImport.errors,
				items: [],
			};
		}

		const results = await this.getResults(parsedImport.validRows.map((row) => row.input));
		const { importFile, calculations } = await this.calculationRepository.createImported({
			importFile: {
				originalName: file.originalname,
				storedName: getStoredFileName(file.path),
				storagePath: file.path,
				mimeType: file.mimetype || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
				sizeBytes: file.size,
				rowCount: parsedImport.totalRows,
			},
			calculations: parsedImport.validRows.map((row, index) => ({
				input: row.input,
				result: results[index],
				sourceRowNumber: row.rowNumber,
			})),
		});

		return {
			importId: importFile.id,
			fileName: importFile.originalName,
			totalRows: parsedImport.totalRows,
			createdCount: calculations.length,
			failedCount: parsedImport.errors.length,
			errors: parsedImport.errors,
			items: calculations,
		};
	}

	async findImportFileDownload(id: string) {
		return this.calculationRepository.findImportFileById(id);
	}

	async clearHistory(): Promise<SqrtClearHistoryResponse> {
		const importFiles = await this.calculationRepository.findImportFiles();
		this.cache.clear();
		const deletedCount = await this.calculationRepository.deleteAll();

		await Promise.all(importFiles.map((importFile) => removeFileIfExists(importFile.storagePath)));

		return { deletedCount };
	}

	private async getResult(input: number): Promise<number> {
		const cachedResult = this.cache.get(input);

		if (cachedResult !== undefined) {
			return cachedResult;
		}

		const result = await calculateSquareRootInWorker(input);
		this.cache.set(input, result);

		return result;
	}

	private async getResults(inputs: number[]): Promise<number[]> {
		const uniqueMissingInputs = [...new Set(inputs.filter((input) => this.cache.get(input) === undefined))];

		if (uniqueMissingInputs.length > 0) {
			const missingResults = await calculateSquareRootsInWorker(uniqueMissingInputs);

			uniqueMissingInputs.forEach((input, index) => {
				this.cache.set(input, missingResults[index]);
			});
		}

		return inputs.map((input) => this.cache.get(input) as number);
	}
}

const removeFileIfExists = async (filePath: string) => {
	await unlink(filePath).catch((error: NodeJS.ErrnoException) => {
		if (error.code !== "ENOENT") {
			throw error;
		}
	});
};
