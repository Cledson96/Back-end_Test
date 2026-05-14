import { OpenAPIRegistry, OpenApiGeneratorV3, extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

const calculationRequestSchema = registry.register(
	"SqrtCalculationRequest",
	z.object({
		input: z.number().min(0).openapi({ example: 9 }),
	}),
);

const calculationResponseSchema = registry.register(
	"SqrtCalculationResponse",
	z.object({
		id: z.string().openapi({ example: "clw0000000000abc123" }),
		input: z.number().openapi({ example: 9 }),
		result: z.number().openapi({ example: 3 }),
		createdAt: z.string().datetime().openapi({ example: "2026-05-14T02:00:00.000Z" }),
		sourceFileId: z.string().optional().openapi({ example: "clwimport000000abc123" }),
		sourceFileName: z.string().optional().openapi({ example: "inputs.xlsx" }),
		sourceRowNumber: z.number().int().optional().openapi({ example: 2 }),
	}),
);

const historyResponseSchema = registry.register(
	"SqrtHistoryResponse",
	z.object({
		items: z.array(calculationResponseSchema),
		nextCursor: z.string().optional().openapi({ example: "clw0000000000abc123" }),
	}),
);

const clearHistoryResponseSchema = registry.register(
	"SqrtClearHistoryResponse",
	z.object({
		deletedCount: z.number().int().openapi({ example: 3 }),
	}),
);

const importRowErrorSchema = registry.register(
	"SqrtImportRowError",
	z.object({
		rowNumber: z.number().int().openapi({ example: 4 }),
		message: z.string().openapi({ example: "Input must be a finite number greater than or equal to zero." }),
		value: z.string().optional().openapi({ example: "-9" }),
	}),
);

const importHistoryResponseSchema = registry.register(
	"SqrtHistoryImportResponse",
	z.object({
		importId: z.string().openapi({ example: "clwimport000000abc123" }),
		fileName: z.string().openapi({ example: "inputs.xlsx" }),
		totalRows: z.number().int().openapi({ example: 5 }),
		createdCount: z.number().int().openapi({ example: 4 }),
		failedCount: z.number().int().openapi({ example: 1 }),
		errors: z.array(importRowErrorSchema),
		items: z.array(calculationResponseSchema),
	}),
);

const serviceResponse = <T extends z.ZodTypeAny>(name: string, responseObjectSchema: T) =>
	registry.register(
		name,
		z.object({
			success: z.boolean(),
			message: z.string(),
			responseObject: responseObjectSchema,
			statusCode: z.number().int(),
		}),
	);

const calculationServiceResponseSchema = serviceResponse("SqrtCalculationServiceResponse", calculationResponseSchema);
const historyServiceResponseSchema = serviceResponse("SqrtHistoryServiceResponse", historyResponseSchema);
const clearHistoryServiceResponseSchema = serviceResponse(
	"SqrtClearHistoryServiceResponse",
	clearHistoryResponseSchema,
);
const importHistoryServiceResponseSchema = serviceResponse(
	"SqrtHistoryImportServiceResponse",
	importHistoryResponseSchema,
);

registry.registerPath({
	method: "post",
	path: "/square-root/calculate",
	summary: "Calculate a square root",
	request: {
		body: {
			content: {
				"application/json": {
					schema: calculationRequestSchema,
				},
			},
		},
	},
	responses: {
		201: {
			description: "Square root calculated successfully.",
			content: {
				"application/json": {
					schema: calculationServiceResponseSchema,
				},
			},
		},
		400: {
			description: "Invalid input.",
		},
	},
});

registry.registerPath({
	method: "get",
	path: "/square-root/history",
	summary: "List calculation history",
	request: {
		query: z.object({
			limit: z.number().int().min(1).max(50).optional().openapi({ example: 10 }),
			cursor: z.string().optional(),
		}),
	},
	responses: {
		200: {
			description: "Calculation history retrieved successfully.",
			content: {
				"application/json": {
					schema: historyServiceResponseSchema,
				},
			},
		},
	},
});

registry.registerPath({
	method: "get",
	path: "/square-root/history/export",
	summary: "Export calculation history to Excel",
	responses: {
		200: {
			description: "Excel workbook generated successfully.",
			content: {
				"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
					schema: z.string().openapi({ format: "binary" }),
				},
			},
		},
	},
});

registry.registerPath({
	method: "post",
	path: "/square-root/history/import",
	summary: "Import square-root inputs from an Excel spreadsheet",
	request: {
		body: {
			content: {
				"multipart/form-data": {
					schema: z.object({
						file: z.string().openapi({ format: "binary" }),
					}),
				},
			},
		},
	},
	responses: {
		201: {
			description: "Spreadsheet imported with at least one valid row.",
			content: {
				"application/json": {
					schema: importHistoryServiceResponseSchema,
				},
			},
		},
		400: {
			description: "Spreadsheet is invalid or contains no valid rows.",
		},
	},
});

registry.registerPath({
	method: "get",
	path: "/square-root/imports/{id}/download",
	summary: "Download the original uploaded spreadsheet",
	request: {
		params: z.object({
			id: z.string().openapi({ example: "clwimport000000abc123" }),
		}),
	},
	responses: {
		200: {
			description: "Original spreadsheet downloaded successfully.",
			content: {
				"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
					schema: z.string().openapi({ format: "binary" }),
				},
			},
		},
		404: {
			description: "Import file was not found.",
		},
	},
});

registry.registerPath({
	method: "delete",
	path: "/square-root/history",
	summary: "Clear calculation history",
	responses: {
		200: {
			description: "Calculation history cleared successfully.",
			content: {
				"application/json": {
					schema: clearHistoryServiceResponseSchema,
				},
			},
		},
	},
});

const generator = new OpenApiGeneratorV3(registry.definitions);

export const openApiDocument = generator.generateDocument({
	openapi: "3.0.0",
	info: {
		title: "Square Root Calculator API",
		version: "1.0.0",
	},
});
