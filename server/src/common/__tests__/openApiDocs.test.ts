import { StatusCodes } from "http-status-codes";
import request from "supertest";

import { app } from "@/server";

describe("OpenAPI documentation", () => {
	it("serves the OpenAPI document", async () => {
		const response = await request(app).get("/docs/openapi.json");

		expect(response.status).toBe(StatusCodes.OK);
		expect(response.body).toMatchObject({
			openapi: "3.0.0",
			info: {
				title: "Square Root Calculator API",
			},
			paths: {
				"/square-root/calculate": expect.any(Object),
				"/square-root/history": expect.any(Object),
			},
		});
	});
});
