import { SqrtAlgorithm } from "./sqrt-algorythm.a-class";

export class NewtonRaphsonAlgorithm extends SqrtAlgorithm {
	protected approximateGuess(): number {
		const currentGuess = this.result === 0 ? this.number / 2 : this.result;

		return 0.5 * (currentGuess + this.number / currentGuess);
	}
}
