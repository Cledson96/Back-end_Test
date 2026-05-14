import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";

import { Router } from "express";
import { StatusCodes } from "http-status-codes";
import multer from "multer";

import { ServiceResponse } from "@/common/models/serviceResponse";
import { env } from "@/common/utils/envConfig";
import { handleServiceResponse, validateRequest } from "@/common/utils/httpHandlers";

import {
	calculateSquareRootBodySchema,
	calculateSquareRootRequestSchema,
	squareRootHistoryQuerySchema,
	squareRootHistoryRequestSchema,
	squareRootImportDownloadParamsSchema,
	squareRootImportDownloadRequestSchema,
} from "./square-root.schemas";
import { SquareRootService } from "./square-root.service";

const squareRootRouter = Router();
const squareRootService = new SquareRootService();
const upload = multer({
	storage: multer.diskStorage({
		destination: (_req, _file, callback) => {
			mkdirSync(env.UPLOAD_DIR, { recursive: true });
			callback(null, env.UPLOAD_DIR);
		},
		filename: (_req, file, callback) => {
			callback(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`);
		},
	}),
	limits: {
		fileSize: 5 * 1024 * 1024,
	},
});

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

squareRootRouter.get("/history/export", async (_req, res, next) => {
	try {
		const exportFile = await squareRootService.exportHistory();

		res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
		res.setHeader("Content-Disposition", `attachment; filename="${exportFile.fileName}"`);

		return res.status(StatusCodes.OK).send(exportFile.workbook);
	} catch (error) {
		next(error);
	}
});

squareRootRouter.post("/history/import", upload.single("file"), async (req, res, next) => {
	try {
		if (!req.file) {
			const serviceResponse = ServiceResponse.failure("Spreadsheet file is required.", null, StatusCodes.BAD_REQUEST);

			return handleServiceResponse(serviceResponse, res);
		}

		const importResult = await squareRootService.importHistory(req.file);
		const statusCode = importResult.createdCount > 0 ? StatusCodes.CREATED : StatusCodes.BAD_REQUEST;
		const message =
			importResult.createdCount > 0
				? "Spreadsheet imported successfully."
				: "Spreadsheet did not contain any valid rows.";
		const serviceResponse =
			importResult.createdCount > 0
				? ServiceResponse.success(message, importResult, statusCode)
				: ServiceResponse.failure(message, importResult, statusCode);

		return handleServiceResponse(serviceResponse, res);
	} catch (error) {
		if (error instanceof Error) {
			const serviceResponse = ServiceResponse.failure(error.message, null, StatusCodes.BAD_REQUEST);

			return handleServiceResponse(serviceResponse, res);
		}

		next(error);
	}
});

squareRootRouter.get(
	"/imports/:id/download",
	validateRequest(squareRootImportDownloadRequestSchema),
	async (req, res, next) => {
		try {
			const { id } = squareRootImportDownloadParamsSchema.parse(req.params);
			const importFile = await squareRootService.findImportFileDownload(id);

			if (!importFile) {
				const serviceResponse = ServiceResponse.failure("Import file was not found.", null, StatusCodes.NOT_FOUND);

				return handleServiceResponse(serviceResponse, res);
			}

			return res.download(importFile.storagePath, importFile.originalName);
		} catch (error) {
			next(error);
		}
	},
);

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
