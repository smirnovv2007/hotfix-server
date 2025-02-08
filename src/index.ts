import "module-alias/register"
import "@UT/catch"

import Logger from "@UT/logger"
import { GetDomain, GetProfile } from "@UT/config"
import { getLocalIpAddress, sleep } from "@UT/library"
import Interface from "@CMD/server/Interface"

const log = new Logger("Main")
const profile = GetProfile()
const domain = GetDomain()

log.info(`Hi ${profile.title} | Domain: ${domain} | ${profile.name} | LOC: ${getLocalIpAddress()}`)

// Function to run a service with error handling and restart logic
// bug https://github.com/wclr/ts-node-dev/issues/209
async function runServiceWithRetry(serviceName: string, importPath: string, runFuncName: string) {
	while (true) {
		try {
			log.info(`Running ${serviceName}...`)
			const module = await import(importPath)
			const runFunc = module.default?.[runFuncName]
			if (typeof runFunc === "function") {
				runFunc()
				break // Exit loop if runFunc succeeds
			} else {
				throw new Error(`${runFuncName} is not a function in ${serviceName}`)
			}
		} catch (error: any) {
			log.error(`Error in ${serviceName}: ${error.message}. Retrying in 5 seconds...`)
			await sleep(5) // 5 seconds delay before retrying
		}
	}
}

async function initializeServices() {
	await runServiceWithRetry("Web", "@SV/web", "Run")
}

initializeServices()
	.then(() => {
		log.info("All services started with delay and error handling.")
	})
	.catch((error) => {
		log.error("Error starting services:", error)
	})

Interface.start()
