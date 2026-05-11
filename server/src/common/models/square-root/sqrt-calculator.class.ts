import type { Calculator } from "./calculator.interface";
import type { SqrtAlgorithm } from "./sqrt-algorythm.a-class";

export class SqrtCalculator implements Calculator {
	private result = 0;

	constructor(
		private readonly number: number,
		private readonly algorithm: SqrtAlgorithm,
	) {
		this.algorithm.setTarget(this.number);
	}

	calculate(): number {
		this.result = this.algorithm.process();
		return this.result;
	}
}
