# Result
A result type is an object type wrapping a returned value or an error. A result type can be used for more elegant error handling than exception handling.

## Why use result types?
When using results types you are forced to handle errors and it is obvious that a function can fail if they return a result type. When relying on exception handling this is not the case. You can choose to not handle a exception or don't even know that a function might throw an exception and the TypeScript compiler will not stop or warn you.

## Usage Example
``` ts
import Result from "@nihility-io/result"

// Function that returns a result instead of throwing
const div = (a: number, b: number): Result<number> => {
	if (b === 0) {
		return Result.failure(new Error("Division by zero."))
	}

	return Result.success(a / b)
}

// Use guards to see if a result is a success or not
const res = div(12, 3)
if (res.isSuccess()) {
	console.log(`12 / 3 = ${res.value}`)
} else if (res.isFailure()) {
	console.log(`12 / 3 = ${res.error.message}`)
} // 12 / 3 = 4

// Better yet use map and match to work with results
const double = res.map((x) => x * 2)
const msg = double.match({
	success: (x) => `(12 / 3) * 2 = ${x}`,
	failure: (err) => `(12 / 3) * 2 = ${err}`,
})
console.log(msg) // (12 / 3) * 2 = 8

// In cases where you want to handle multiple results at once
// using filter (ignore errors) or combine (require that 
// everything is a success )
const calculations = [div(12, 3), div(12, 0), div(12, 4)]
console.log(Result.filter(calculations)) // [ 4, 3 ]

const msg2 = Result.combine(calculations).match({
	success: (x) => `x = ${x}`,
	failure: (err) => `x = ${err}`,
})
console.log(msg2) // x = Error: Division by zero.

```