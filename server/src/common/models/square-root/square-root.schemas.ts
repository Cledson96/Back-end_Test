import { z } from "zod";

export const calculateSquareRootRequestSchema = z.object({
	body: z.object({
		input: z
			.number({
				invalid_type_error: "Input must be a number.",
				required_error: "Input is required.",
			})
			.finite("Input must be finite.")
			.min(0, "Input must be greater than or equal to zero."),
	}),
});

export const squareRootHistoryRequestSchema = z.object({
	query: z.object({
		limit: z
			.preprocess(
				(value) => (value === undefined ? 10 : Number(value)),
				z.number().int().min(1, "Limit must be at least 1.").max(50, "Limit must be at most 50."),
			)
			.default(10),
		cursor: z.string().optional(),
	}),
});

export const calculateSquareRootBodySchema = calculateSquareRootRequestSchema.shape.body;
export const squareRootHistoryQuerySchema = squareRootHistoryRequestSchema.shape.query;
