import path from "node:path";
import { Worker } from "node:worker_threads";

type WorkerSuccessMessage = number;

export const calculateSquareRootInWorker = (input: number): Promise<number> => {
	const workerPath = path.join(__dirname, `square-root.worker.${getWorkerExtension()}`);

	return new Promise((resolve, reject) => {
		const worker = new Worker(workerPath, {
			execArgv: workerPath.endsWith(".ts") ? ["--require", "tsx/cjs"] : [],
			workerData: { input },
		});

		worker.once("message", (result: WorkerSuccessMessage) => {
			resolve(result);
		});
		worker.once("error", reject);
		worker.once("exit", (code) => {
			if (code !== 0) {
				reject(new Error(`Square root worker stopped with exit code ${code}.`));
			}
		});
	});
};

const getWorkerExtension = () => (__filename.endsWith(".ts") ? "ts" : "js");
