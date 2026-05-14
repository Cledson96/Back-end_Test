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
};

export type SqrtHistoryResponse = {
	items: SqrtCalculationResponse[];
	nextCursor?: string;
};

export type SqrtClearHistoryResponse = {
	deletedCount: number;
};

export type ApiServiceResponse<T> = {
	success: boolean;
	message: string;
	responseObject: T;
	statusCode: number;
};
