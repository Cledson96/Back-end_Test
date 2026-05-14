import type { SqrtCalculationResponse, SqrtClearHistoryResponse, SqrtHistoryResponse } from "@shared/types";

import { CalculationRepository } from "./calculation.repository";
import { calculateSquareRootInWorker } from "./square-root.worker-runner";

type FindHistoryInput = {
	limit: number;
	cursor?: string;
};

export class SquareRootService {
	private readonly cache = new Map<number, number>();

	constructor(private readonly calculationRepository = new CalculationRepository()) {}

	async calculate(input: number): Promise<SqrtCalculationResponse> {
		const result = await this.getResult(input);

		return this.calculationRepository.create({ input, result });
	}

	async findHistory(input: FindHistoryInput): Promise<SqrtHistoryResponse> {
		return this.calculationRepository.findMany(input);
	}

	async clearHistory(): Promise<SqrtClearHistoryResponse> {
		this.cache.clear();
		const deletedCount = await this.calculationRepository.deleteAll();

		return { deletedCount };
	}

	private async getResult(input: number): Promise<number> {
		const cachedResult = this.cache.get(input);

		if (cachedResult !== undefined) {
			return cachedResult;
		}

		const result = await calculateSquareRootInWorker(input);
		this.cache.set(input, result);

		return result;
	}
}
