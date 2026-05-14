import { existsSync } from "node:fs";
import path from "node:path";
import { Worker } from "node:worker_threads";

type WorkerSuccessMessage = number | number[];

export const calculateSquareRootInWorker = (input: number): Promise<number> => {
	return runSquareRootWorker({ input }) as Promise<number>;
};

export const calculateSquareRootsInWorker = (inputs: number[]): Promise<number[]> => {
	if (inputs.length === 0) {
		return Promise.resolve([]);
	}

	return runSquareRootWorker({ inputs }) as Promise<number[]>;
};

const runSquareRootWorker = (workerData: { input?: number; inputs?: number[] }): Promise<WorkerSuccessMessage> => {
	const workerPath = resolveSquareRootWorkerPath();

	return new Promise((resolve, reject) => {
		const worker = new Worker(workerPath, {
			execArgv: workerPath.endsWith(".ts") ? ["--require", "tsx/cjs"] : [],
			workerData,
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

export const resolveSquareRootWorkerPath = (runtimeDirectory = __dirname, runtimeFilename = __filename) => {
	const workerFileName = `square-root.worker.${getWorkerExtension(runtimeFilename)}`;
	const candidates = [
		path.join(runtimeDirectory, workerFileName),
		path.join(runtimeDirectory, "common", "models", "square-root", workerFileName),
	];
	const workerPath = candidates.find((candidate) => existsSync(candidate));

	if (!workerPath) {
		throw new Error(`Square root worker file was not found. Checked: ${candidates.join(", ")}`);
	}

	return workerPath;
};

const getWorkerExtension = (runtimeFilename = __filename) => (runtimeFilename.endsWith(".ts") ? "ts" : "js");
