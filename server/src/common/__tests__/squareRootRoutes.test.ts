import { StatusCodes } from "http-status-codes";
import request from "supertest";

import { prisma } from "@/common/database/prisma";
import { app } from "@/server";

describe("Square root routes", () => {
	beforeEach(async () => {
		await prisma.calculation.deleteMany();
	});

	afterAll(async () => {
		await prisma.calculation.deleteMany();
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
});
