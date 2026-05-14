/**
 * Shared DTOs for the square-root calculator API and client.
 * Import from `@shared/types` in both `server/` and `client/`.
 */

export type SqrtCalculationRequest = {
	input: number;
};

export type SqrtCalculationResponse = {
	id: string;
	input: number;
	result: number;
	createdAt: string;
	sourceFileId?: string;
	sourceFileName?: string;
	sourceRowNumber?: number;
};

export type SqrtHistoryResponse = {
	items: SqrtCalculationResponse[];
	nextCursor?: string;
};

export type SqrtClearHistoryResponse = {
	deletedCount: number;
};

export type SqrtImportRowError = {
	rowNumber: number;
	message: string;
	value?: string;
};

export type SqrtHistoryImportResponse = {
	importId: string;
	fileName: string;
	totalRows: number;
	createdCount: number;
	failedCount: number;
	errors: SqrtImportRowError[];
	items: SqrtCalculationResponse[];
};

export type ApiServiceResponse<T> = {
	success: boolean;
	message: string;
	responseObject: T;
	statusCode: number;
};
