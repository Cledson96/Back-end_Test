import type { SqrtCalculationRequest } from "@shared/types";
import "./App.css";

/** Minimal shell — implement the calculator UI per the take-home README. */
function App() {
	const _exampleRequest: SqrtCalculationRequest = { input: 0 };

	return (
		<main className="app">
			<h1>Square root calculator</h1>
			<p className="hint">
				Build the form, history table, and API wiring here. Shared types are available from{" "}
				<code>@shared/types</code> (example: input is {_exampleRequest.input}).
			</p>
		</main>
	);
}

export default App;
