import { SqrtAlgorithm } from "./sqrt-algorythm.a-class";

// Implementation of the Newton-Raphson algorithm: x(n+1) = 0.5 * (x(n) + number/x(n))
// 1. Start with an initial guess
// 2. Update the guess by averaging it with the number divided by the guess
// 3. Repeat step 2 until the guess is within the tolerance
// 4. Return the guess

export class NewtonRaphsonAlgorithm extends SqrtAlgorithm {}
