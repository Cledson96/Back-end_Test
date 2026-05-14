import { Router } from "express";
import { StatusCodes } from "http-status-codes";

import { ServiceResponse } from "@/common/models/serviceResponse";
import { handleServiceResponse, validateRequest } from "@/common/utils/httpHandlers";

import {
	calculateSquareRootBodySchema,
	calculateSquareRootRequestSchema,
	squareRootHistoryQuerySchema,
	squareRootHistoryRequestSchema,
} from "./square-root.schemas";
import { SquareRootService } from "./square-root.service";

const squareRootRouter = Router();
const squareRootService = new SquareRootService();

squareRootRouter.post("/calculate", validateRequest(calculateSquareRootRequestSchema), async (req, res, next) => {
	try {
		const { input } = calculateSquareRootBodySchema.parse(req.body);
		const calculation = await squareRootService.calculate(input);
		const serviceResponse = ServiceResponse.success(
			"Square root calculated successfully.",
			calculation,
			StatusCodes.CREATED,
		);

		return handleServiceResponse(serviceResponse, res);
	} catch (error) {
		next(error);
	}
});

squareRootRouter.get("/history", validateRequest(squareRootHistoryRequestSchema), async (req, res, next) => {
	try {
		const query = squareRootHistoryQuerySchema.parse(req.query);
		const history = await squareRootService.findHistory(query);
		const serviceResponse = ServiceResponse.success("Calculation history retrieved successfully.", history);

		return handleServiceResponse(serviceResponse, res);
	} catch (error) {
		next(error);
	}
});

squareRootRouter.delete("/history", async (_req, res, next) => {
	try {
		const result = await squareRootService.clearHistory();
		const serviceResponse = ServiceResponse.success("Calculation history cleared successfully.", result);

		return handleServiceResponse(serviceResponse, res);
	} catch (error) {
		next(error);
	}
});

export default squareRootRouter;
