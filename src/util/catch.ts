export function setupCatchHandlers() {
	process.on("uncaughtException", (e: Error) => {
		console.log("uncaughtException", e)
		process.exit(0)
	})

	process.on("unhandledRejection", (e: any, promise: Promise<any>) => {
		console.log("unhandledRejection", e)
	})

	process.on("SIGINT", () => {
		console.info("exit app")
		process.exit(0)
	})
}
// Call setupCatchHandlers immediately when this module is imported
setupCatchHandlers()
