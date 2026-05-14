import { existsSync } from "node:fs";

import ExcelJS from "exceljs";
import { StatusCodes } from "http-status-codes";
import request from "supertest";

import { prisma } from "@/common/database/prisma";
import { app } from "@/server";

describe("Square root routes", () => {
	beforeEach(async () => {
		await prisma.calculation.deleteMany();
		await prisma.importFile.deleteMany();
	});

	afterAll(async () => {
		await prisma.calculation.deleteMany();
		await prisma.importFile.deleteMany();
		await prisma.$disconnect();
	});

	it("calculates a square root and persists the result", async () => {
		const response = await request(app).post("/square-root/calculate").send({ input: 9 });

		expect(response.status).toBe(StatusCodes.CREATED);
		expect(response.body).toMatchObject({
			success: true,
			message: "Square root calculated successfully.",
			statusCode: StatusCodes.CREATED,
			responseObject: {
				input: 9,
			},
		});
		expect(response.body.responseObject.result).toBeCloseTo(3, 7);
		expect(response.body.responseObject.id).toEqual(expect.any(String));
		expect(new Date(response.body.responseObject.createdAt).toString()).not.toBe("Invalid Date");

		const persistedCalculations = await prisma.calculation.findMany();
		expect(persistedCalculations).toHaveLength(1);
	});

	it("rejects negative inputs", async () => {
		const response = await request(app).post("/square-root/calculate").send({ input: -4 });

		expect(response.status).toBe(StatusCodes.BAD_REQUEST);
		expect(response.body).toMatchObject({
			success: false,
			statusCode: StatusCodes.BAD_REQUEST,
		});
		expect(response.body.message).toContain("Input must be greater than or equal to zero.");
	});

	it("returns a JSON error response for malformed JSON payloads", async () => {
		const response = await request(app)
			.post("/square-root/calculate")
			.set("Content-Type", "application/json")
			.send('{"input":');

		expect(response.status).toBe(StatusCodes.BAD_REQUEST);
		expect(response.body).toMatchObject({
			success: false,
			responseObject: null,
			statusCode: StatusCodes.BAD_REQUEST,
		});
	});

	it("returns cursor-paginated history", async () => {
		await request(app).post("/square-root/calculate").send({ input: 4 });
		await request(app).post("/square-root/calculate").send({ input: 9 });
		await request(app).post("/square-root/calculate").send({ input: 16 });

		const firstPage = await request(app).get("/square-root/history").query({ limit: 2 });
		const secondPage = await request(app).get("/square-root/history").query({
			limit: 2,
			cursor: firstPage.body.responseObject.nextCursor,
		});

		expect(firstPage.status).toBe(StatusCodes.OK);
		expect(firstPage.body.responseObject.items).toHaveLength(2);
		expect(firstPage.body.responseObject.items.map((item: { input: number }) => item.input)).toEqual([16, 9]);
		expect(firstPage.body.responseObject.nextCursor).toEqual(firstPage.body.responseObject.items[1].id);

		expect(secondPage.status).toBe(StatusCodes.OK);
		expect(secondPage.body.responseObject.items).toHaveLength(1);
		expect(secondPage.body.responseObject.items[0].input).toBe(4);
		expect(secondPage.body.responseObject.nextCursor).toBeUndefined();
	});

	it("clears calculation history", async () => {
		await request(app).post("/square-root/calculate").send({ input: 25 });
		await request(app).post("/square-root/calculate").send({ input: 36 });

		const deleteResponse = await request(app).delete("/square-root/history");
		const historyResponse = await request(app).get("/square-root/history");

		expect(deleteResponse.status).toBe(StatusCodes.OK);
		expect(deleteResponse.body.responseObject).toEqual({ deletedCount: 2 });
		expect(historyResponse.body.responseObject.items).toHaveLength(0);
	});

	it("imports valid spreadsheet rows and reports invalid rows", async () => {
		const workbook = await createWorkbookBuffer([["input"], [9], [-4], ["abc"], [16]]);

		const response = await request(app).post("/square-root/history/import").attach("file", workbook, "inputs.xlsx");
		const historyResponse = await request(app).get("/square-root/history").query({ limit: 10 });

		expect(response.status).toBe(StatusCodes.CREATED);
		expect(response.body.responseObject).toMatchObject({
			fileName: "inputs.xlsx",
			totalRows: 4,
			createdCount: 2,
			failedCount: 2,
		});
		expect(response.body.responseObject.errors).toEqual([
			expect.objectContaining({ rowNumber: 3 }),
			expect.objectContaining({ rowNumber: 4 }),
		]);
		expect(response.body.responseObject.items.map((item: { input: number }) => item.input)).toEqual([9, 16]);
		expect(historyResponse.body.responseObject.items[0]).toMatchObject({
			input: 16,
			sourceFileName: "inputs.xlsx",
			sourceRowNumber: 5,
		});
	});

	it("rejects spreadsheets with no valid rows", async () => {
		const workbook = await createWorkbookBuffer([["input"], [-4], ["abc"]]);

		const response = await request(app).post("/square-root/history/import").attach("file", workbook, "invalid.xlsx");
		const persistedCalculations = await prisma.calculation.findMany();
		const persistedImportFiles = await prisma.importFile.findMany();

		expect(response.status).toBe(StatusCodes.BAD_REQUEST);
		expect(response.body.responseObject).toMatchObject({
			fileName: "invalid.xlsx",
			totalRows: 2,
			createdCount: 0,
			failedCount: 2,
		});
		expect(persistedCalculations).toHaveLength(0);
		expect(persistedImportFiles).toHaveLength(0);
	});

	it("rejects spreadsheets with more than one thousand rows", async () => {
		const rows = [["input"], ...Array.from({ length: 1001 }, (_value, index) => [index + 1])];
		const workbook = await createWorkbookBuffer(rows);

		const response = await request(app)
			.post("/square-root/history/import")
			.attach("file", workbook, "too-many-rows.xlsx");

		expect(response.status).toBe(StatusCodes.BAD_REQUEST);
		expect(response.body.message).toContain("at most 1000 data rows");
	});

	it("rejects spreadsheets without an input column", async () => {
		const workbook = await createWorkbookBuffer([["number"], [9]]);

		const response = await request(app)
			.post("/square-root/history/import")
			.attach("file", workbook, "missing-input.xlsx");

		expect(response.status).toBe(StatusCodes.BAD_REQUEST);
		expect(response.body.message).toContain('"input" column');
	});

	it("exports calculation history as an Excel workbook", async () => {
		await request(app).post("/square-root/calculate").send({ input: 25 });

		const response = await request(app).get("/square-root/history/export").buffer(true).parse(binaryParser);
		const workbook = new ExcelJS.Workbook();
		await workbook.xlsx.load(response.body);
		const worksheet = workbook.getWorksheet("Calculations");

		expect(response.status).toBe(StatusCodes.OK);
		expect(response.headers["content-type"]).toContain(
			"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		);
		expect(worksheet?.getRow(1).values).toEqual([undefined, "Input", "Result", "Created At", "Source", "Source Row"]);
		expect(worksheet?.getRow(2).getCell(1).value).toBe(25);
		expect(worksheet?.getRow(2).getCell(2).value).toBeCloseTo(5, 7);
	});

	it("downloads the original imported spreadsheet", async () => {
		const workbook = await createWorkbookBuffer([["input"], [81]]);
		const importResponse = await request(app)
			.post("/square-root/history/import")
			.attach("file", workbook, "download-me.xlsx");

		const response = await request(app)
			.get(`/square-root/imports/${importResponse.body.responseObject.importId}/download`)
			.buffer(true)
			.parse(binaryParser);

		expect(response.status).toBe(StatusCodes.OK);
		expect(response.headers["content-disposition"]).toContain("download-me.xlsx");
		expect(response.body.length).toBeGreaterThan(0);
	});

	it("clears imported file metadata and stored spreadsheets with history", async () => {
		const workbook = await createWorkbookBuffer([["input"], [100]]);
		await request(app).post("/square-root/history/import").attach("file", workbook, "clear-me.xlsx");
		const importFile = await prisma.importFile.findFirstOrThrow();

		const response = await request(app).delete("/square-root/history");
		const persistedImportFiles = await prisma.importFile.findMany();

		expect(response.status).toBe(StatusCodes.OK);
		expect(response.body.responseObject.deletedCount).toBe(1);
		expect(persistedImportFiles).toHaveLength(0);
		expect(existsSync(importFile.storagePath)).toBe(false);
	});
});

const createWorkbookBuffer = async (rows: Array<Array<string | number>>) => {
	const workbook = new ExcelJS.Workbook();
	const worksheet = workbook.addWorksheet("Inputs");

	for (const row of rows) {
		worksheet.addRow(row);
	}

	const buffer = await workbook.xlsx.writeBuffer();

	return Buffer.from(buffer);
};

const binaryParser = (response: request.Response, callback: (error: Error | null, body: Buffer) => void) => {
	let data = "";

	response.setEncoding("binary");
	response.on("data", (chunk: string) => {
		data += chunk;
	});
	response.on("end", () => callback(null, Buffer.from(data, "binary")));
};
