// deno-lint-ignore-file no-explicit-any
import { assertEquals, assertInstanceOf, assertThrows } from "@std/assert"
import { z } from "zod"
import Result, { Failure, Success } from "./mod.ts"

interface Person {
	name: string
}

const Person = z.object({
	name: z.string(),
})

class MyError extends Error {
	constructor(message: string) {
		super(message)
		this.name = "MyError"
	}
}

const assertFailureEquals = (e1: Failure<unknown>, e2: Failure<unknown>) => {
	assertErrorEquals(e1.error, e2.error)
}

const assertErrorEquals = (e1: Error, e2: Error) => {
	assertEquals(e1.name, e2.name)
	assertEquals(e1.message, e2.message)
}

Deno.test("Encoding/Decoding", async (t) => {
	const successResult = Result.success<Person>({ name: "John Smith" })
	const successJson = `{"status":"success","value":{"name":"John Smith"}}`

	const failureResult = Result.failure<Person>(new MyError("Oh, no!"))
	const failureJson = `{"status":"failure","error":{"name":"MyError","message":"Oh, no!"}}`

	const nestedResult = { msg: "Hello World!", person: successResult }
	const nestedJson = `{"msg":"Hello World!","person":${successJson}}`

	await t.step("JSON Encoding", async (t) => {
		await t.step("Success", () => {
			assertEquals(JSON.stringify(successResult), successJson)
		})

		await t.step("Failure", () => {
			assertEquals(JSON.stringify(failureResult), failureJson)
		})

		await t.step("Nested", () => {
			assertEquals(JSON.stringify(nestedResult), nestedJson)
		})
	})

	await t.step("JSON Decoding", async (t) => {
		await t.step("Success", () => {
			const resJ = JSON.parse(successJson, Result.JSONReviver)
			const resR = Result.fromJson(successJson, Person)
			assertInstanceOf(resJ, Success as any)
			assertInstanceOf(resJ, Result as any)
			assertInstanceOf(resR, Success as any)
			assertInstanceOf(resR, Result as any)
			assertEquals(resJ as Result<Person>, successResult)
			assertEquals(resR as Result<Person>, successResult)
		})

		await t.step("Failure", () => {
			const resJ = JSON.parse(failureJson, Result.JSONReviver)
			const resR = Result.fromJson(failureJson, Person)
			assertInstanceOf(resJ, Failure as any)
			assertInstanceOf(resJ, Result as any)
			assertInstanceOf(resR, Failure as any)
			assertInstanceOf(resR, Result as any)
			assertFailureEquals(resJ as Failure<Person>, failureResult as Failure<unknown>)
			assertFailureEquals(resR as Failure<Person>, failureResult as Failure<unknown>)
		})

		await t.step("Nested", () => {
			const resJ = JSON.parse(nestedJson, Result.JSONReviver)
			assertEquals(resJ, nestedResult)
		})
	})

	const err = new Error("My Error")
	const expectedErr = { name: "Error", message: "My Error" }
	const typeErr = new TypeError("My Error")
	const expectedTypeErr = { name: "TypeError", message: "My Error" }

	await t.step("Error Encoding", () => {
		const resErr = Result.errorEncoder(err)
		const resTypeErr = Result.errorEncoder(typeErr)

		assertEquals(resErr, expectedErr)
		assertEquals(resTypeErr, expectedTypeErr)
	})

	await t.step("Error Decoding", () => {
		const resErr = Result.errorDecoder(expectedErr.name, expectedErr.message, expectedErr)
		const resTypeErr = Result.errorDecoder(expectedTypeErr.name, expectedTypeErr.message, expectedTypeErr)

		assertErrorEquals(resErr, err)
		assertErrorEquals(resTypeErr, typeErr)
	})
})

Deno.test("Functions", async (t) => {
	const success = Result.success(5)
	const failure = Result.failure<number>(new Error("Error"))
	const expectedSuccess = Result.success(10)
	const expectedFailure = Result.failure<number>(new Error("Error"))
	const resultListSuccess = [
		Result.success(1),
		Result.success(2),
		Result.success(3),
	]
	const resultListFailure = [
		Result.success(1),
		Result.failure<number>(new Error("Error")),
		Result.success(2),
		Result.success(3),
	]
	const expectedFilter = [1, 2, 3]
	const expectedCombineSuccess = Result.success([1, 2, 3])
	const expectedCombineFailure = Result.failure<number[]>(new Error("Error"))

	await t.step("IsSuccess", async (t) => {
		await t.step("Success", () => {
			assertEquals(success.isSuccess(), true)
			assertEquals(Result.isSuccess(success), true)
		})

		await t.step("Failure", () => {
			assertEquals(failure.isFailure(), true)
			assertEquals(Result.isFailure(failure), true)
		})
	})

	await t.step("IsFailure", async (t) => {
		await t.step("Success", () => {
			assertEquals(success.isSuccess(), true)
			assertEquals(Result.isSuccess(success), true)
		})

		await t.step("Failure", () => {
			assertEquals(failure.isFailure(), true)
			assertEquals(Result.isFailure(failure), true)
		})
	})

	await t.step("Unwrap", async (t) => {
		await t.step("Success", () => {
			assertEquals(success.unwrap(), 5)
		})

		await t.step("Failure", () => {
			assertEquals(failure.unwrap(10), 10)
			assertThrows(() => failure.unwrap(), "Error")
		})
	})

	await t.step("Map", async (t) => {
		await t.step("Success", () => {
			assertEquals(success.map((x) => x * 2), expectedSuccess)
			assertEquals(success.map((x) => Result.success(x * 2)), expectedSuccess)
			assertEquals(success.map((_x) => Result.failure(new Error("Error"))), expectedFailure)
		})

		await t.step("Failure", () => {
			assertEquals(failure.map((x) => x * 2), expectedFailure)
			assertEquals(failure.map((x) => Result.success(x * 2)), expectedFailure)
			assertEquals(failure.map((_x) => Result.failure(new Error("Error"))), expectedFailure)
		})
	})

	await t.step("Match", async (t) => {
		await t.step("Success", () => {
			assertEquals(
				success.match({
					success: (x) => x * 2,
					failure: (_e) => 1,
				}),
				10,
			)
		})

		await t.step("Failure", () => {
			assertEquals(
				failure.match({
					success: (x) => x * 2,
					failure: (_e) => 1,
				}),
				1,
			)
		})
	})

	await t.step("Filter", async (t) => {
		await t.step("Success", () => {
			assertEquals(Result.filter(resultListSuccess), expectedFilter)
		})

		await t.step("Failure", () => {
			assertEquals(Result.filter(resultListFailure), expectedFilter)
		})
	})

	await t.step("Combine", async (t) => {
		await t.step("Success", () => {
			assertEquals(Result.combine(resultListSuccess), expectedCombineSuccess)
		})

		await t.step("Failure", () => {
			assertEquals(Result.combine(resultListFailure), expectedCombineFailure)
		})
	})

	await t.step("FromTry", async (t) => {
		await t.step("Success", () => {
			assertEquals(Result.fromTry(() => 5), success)
		})

		await t.step("Failure", () => {
			assertFailureEquals(
				Result.fromTry<number>(() => {
					throw new Error("Error")
				}) as Failure<number>,
				failure as Failure<number>,
			)
		})
	})

	await t.step("FromPromise", async (t) => {
		await t.step("fromTry", async () => {
			assertEquals(await Result.fromPromise(new Promise<number>((resolve) => resolve(5))), success)
		})

		await t.step("Failure", async () => {
			assertFailureEquals(
				await Result.fromPromise(
					new Promise<number>((resolve, reject) => reject(new Error("Error"))),
				) as Failure<number>,
				failure as Failure<number>,
			)
		})
	})
})
