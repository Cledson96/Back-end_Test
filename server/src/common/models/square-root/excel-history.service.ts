import { unlink } from "node:fs/promises";
import path from "node:path";

import type { SqrtCalculationResponse, SqrtImportRowError } from "@shared/types";
import ExcelJS from "exceljs";

const MAX_IMPORT_ROWS = 1000;
const INPUT_COLUMN_NAME = "input";

export type ParsedExcelImport = {
	totalRows: number;
	validRows: Array<{
		input: number;
		rowNumber: number;
	}>;
	errors: SqrtImportRowError[];
};

export type UploadedExcelFile = {
	originalname: string;
	filename: string;
	path: string;
	mimetype: string;
	size: number;
};

export class ExcelHistoryService {
	async parseImportFile(file: UploadedExcelFile): Promise<ParsedExcelImport> {
		if (!file.originalname.toLowerCase().endsWith(".xlsx")) {
			await removeFileIfExists(file.path);
			throw new Error("Only .xlsx spreadsheets are supported.");
		}

		const workbook = new ExcelJS.Workbook();
		await workbook.xlsx.readFile(file.path);
		const worksheet = workbook.worksheets[0];

		if (!worksheet) {
			await removeFileIfExists(file.path);
			throw new Error("Spreadsheet must contain at least one worksheet.");
		}

		const inputColumn = findInputColumn(worksheet);

		if (!inputColumn) {
			await removeFileIfExists(file.path);
			throw new Error('Spreadsheet must contain an "input" column in the first row.');
		}

		const parsedRows = parseInputRows(worksheet, inputColumn);

		if (parsedRows.totalRows > MAX_IMPORT_ROWS) {
			await removeFileIfExists(file.path);
			throw new Error(`Spreadsheet must contain at most ${MAX_IMPORT_ROWS} data rows.`);
		}

		return parsedRows;
	}

	async buildHistoryWorkbook(calculations: SqrtCalculationResponse[]): Promise<Buffer> {
		const workbook = new ExcelJS.Workbook();
		const worksheet = workbook.addWorksheet("Calculations");

		worksheet.columns = [
			{ header: "Input", key: "input", width: 18 },
			{ header: "Result", key: "result", width: 24 },
			{ header: "Created At", key: "createdAt", width: 28 },
			{ header: "Source", key: "source", width: 32 },
			{ header: "Source Row", key: "sourceRow", width: 14 },
		];

		for (const calculation of calculations) {
			worksheet.addRow({
				input: calculation.input,
				result: calculation.result,
				createdAt: calculation.createdAt,
				source: calculation.sourceFileName ?? "Manual",
				sourceRow: calculation.sourceRowNumber ?? "",
			});
		}

		worksheet.getRow(1).font = { bold: true };

		const buffer = await workbook.xlsx.writeBuffer();

		return Buffer.from(buffer);
	}
}

export const getDownloadFileName = () => `square-root-history-${new Date().toISOString().slice(0, 10)}.xlsx`;

export const getStoredFileName = (filePath: string) => path.basename(filePath);

const findInputColumn = (worksheet: ExcelJS.Worksheet) => {
	const headerRow = worksheet.getRow(1);
	let inputColumn: number | undefined;

	headerRow.eachCell((cell, columnNumber) => {
		if (normalizeCellValue(cell.value) === INPUT_COLUMN_NAME) {
			inputColumn = columnNumber;
		}
	});

	return inputColumn;
};

const parseInputRows = (worksheet: ExcelJS.Worksheet, inputColumn: number): ParsedExcelImport => {
	const validRows: ParsedExcelImport["validRows"] = [];
	const errors: SqrtImportRowError[] = [];
	let totalRows = 0;

	for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
		const cell = worksheet.getRow(rowNumber).getCell(inputColumn);
		const rawValue = getCellDisplayValue(cell.value);

		if (rawValue.trim() === "") {
			continue;
		}

		totalRows += 1;

		const input = Number(rawValue);

		if (!Number.isFinite(input) || input < 0) {
			errors.push({
				rowNumber,
				message: "Input must be a finite number greater than or equal to zero.",
				value: rawValue,
			});
			continue;
		}

		validRows.push({ input, rowNumber });
	}

	return { totalRows, validRows, errors };
};

const normalizeCellValue = (value: ExcelJS.CellValue) => getCellDisplayValue(value).trim().toLowerCase();

const getCellDisplayValue = (value: ExcelJS.CellValue): string => {
	if (value === null || value === undefined) {
		return "";
	}

	if (typeof value === "object") {
		if ("result" in value && value.result !== undefined) {
			return String(value.result);
		}

		if ("text" in value && value.text !== undefined) {
			return String(value.text);
		}

		if (value instanceof Date) {
			return value.toISOString();
		}
	}

	return String(value);
};

const removeFileIfExists = async (filePath: string) => {
	await unlink(filePath).catch((error: NodeJS.ErrnoException) => {
		if (error.code !== "ENOENT") {
			throw error;
		}
	});
};
