import type { ErrorRequestHandler, RequestHandler } from "express";
import { StatusCodes } from "http-status-codes";

import { ServiceResponse } from "@/common/models/serviceResponse";
import { handleServiceResponse } from "@/common/utils/httpHandlers";

const unexpectedRequest: RequestHandler = (_req, res) => {
	const serviceResponse = ServiceResponse.failure("Route not found.", null, StatusCodes.NOT_FOUND);

	return handleServiceResponse(serviceResponse, res);
};

const addErrorToRequestLog: ErrorRequestHandler = (err, _req, res, next) => {
	res.locals.err = err;
	next(err);
};

const returnErrorResponse: ErrorRequestHandler = (err, _req, res, next) => {
	if (res.headersSent) {
		return next(err);
	}

	const statusCode = getErrorStatusCode(err);
	const message = statusCode >= StatusCodes.INTERNAL_SERVER_ERROR ? "Internal server error." : getErrorMessage(err);
	const serviceResponse = ServiceResponse.failure(message, null, statusCode);

	return handleServiceResponse(serviceResponse, res);
};

const getErrorStatusCode = (error: unknown) => {
	if (!isErrorLike(error)) {
		return StatusCodes.INTERNAL_SERVER_ERROR;
	}

	const statusCode = error.statusCode ?? error.status;

	if (typeof statusCode === "number" && statusCode >= 400 && statusCode < 600) {
		return statusCode;
	}

	return StatusCodes.INTERNAL_SERVER_ERROR;
};

const getErrorMessage = (error: unknown) => {
	if (isErrorLike(error) && typeof error.message === "string" && error.message.length > 0) {
		return error.message;
	}

	return "Request failed.";
};

const isErrorLike = (error: unknown): error is { message?: unknown; status?: unknown; statusCode?: unknown } =>
	typeof error === "object" && error !== null;

export default () => [unexpectedRequest, addErrorToRequestLog, returnErrorResponse];
