import { parentPort, workerData } from "node:worker_threads";

import { NewtonRaphsonAlgorithm } from "./newton-raphson-algorythm.class";
import { SqrtCalculator } from "./sqrt-calculator.class";

const calculate = () => {
	const calculator = new SqrtCalculator(workerData.input, new NewtonRaphsonAlgorithm());

	return calculator.calculate();
};

parentPort?.postMessage(calculate());
