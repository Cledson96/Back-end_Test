import { parentPort, workerData } from "node:worker_threads";

import { NewtonRaphsonAlgorithm } from "./newton-raphson-algorythm.class";
import { SqrtCalculator } from "./sqrt-calculator.class";

const calculateOne = (input: number) => {
	const calculator = new SqrtCalculator(input, new NewtonRaphsonAlgorithm());

	return calculator.calculate();
};

const calculate = () => {
	if (Array.isArray(workerData.inputs)) {
		return workerData.inputs.map((input: number) => calculateOne(input));
	}

	return calculateOne(workerData.input);
};

parentPort?.postMessage(calculate());
