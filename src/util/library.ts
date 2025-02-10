import fs from "fs/promises"
import Logger from "@UT/logger"
import axios, { AxiosError } from "axios"
import https from "https"
import crypto from "crypto"
import os from "os"
import path from "path"
import { createWriteStream } from "fs"
import { pipeline } from "stream/promises"

const log = new Logger("Library")

export function getLocalIpAddress(): string {
	const networkInterfaces = os.networkInterfaces()
	for (const ifaceName in networkInterfaces) {
		const iface = networkInterfaces[ifaceName]
		if (iface == undefined) {
			return "?"
		}
		for (const entry of iface) {
			if (!entry.internal && entry.family === "IPv4") {
				return entry.address
			}
		}
	}
	return "Unknown"
}

export function sleep(ms: number) {
	return new Promise((resolve) => {
		setTimeout(resolve, 1000 * ms)
	})
}

export function removeControlChars(str: string): string {
	return str.replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
}

function trimAny(str: string, chars: string = " "): string {
	let start = 0,
		end = str.length

	while (start < end && chars.indexOf(str[start]) >= 0) ++start
	while (end > start && chars.indexOf(str[end - 1]) >= 0) --end

	return start > 0 || end < str.length ? str.substring(start, end) : str
}

export async function forceDownload(link: string, fileFullPath: string, maxRetries: number = 3): Promise<number> {
	link = trimAny(removeControlChars(link))
	fileFullPath = trimAny(removeControlChars(fileFullPath))

	const fileName = path.basename(fileFullPath)
	const dir = path.dirname(fileFullPath)
	await fs.mkdir(dir, { recursive: true }).catch((err) => log.errorNoStack(`Failed to create directory: ${dir}`, err))

	const fileExists = await fs
		.access(fileFullPath)
		.then(() => true)
		.catch(() => false)

	if (fileExists) {
		const isRemove = await fs
			.unlink(fileFullPath)
			.then(() => true)
			.catch(() => false)
		log.warn(`Found file ${fileFullPath}, removed: ${isRemove}`)
	}

	log.debug(`Start downloading file: ${fileName} from ${link}`)

	let attempt = 0
	while (attempt < maxRetries) {
		try {
			const startTime = Date.now()

			const response = await axios.get(link, {
				responseType: "stream",
				timeout: 1000 * 30,
				httpsAgent: new https.Agent({
					rejectUnauthorized: false
				})
			})

			if (response.status === 404) {
				log.errorNoStack(`File ${link} not found`)
				return -1
			}
			if (response.status !== 200) {
				log.errorNoStack(`File failed to download ${link}:`, response.statusText)
				attempt++
				continue
			}

			const totalLength = Number(response.headers["content-length"]) || 0
			let downloadedLength = 0
			let lastUpdate = Date.now()
			let lastCheckSpeedTime = Date.now()
			let lastDownloadedLength = 0
			let slowDownloadCount = 0

			const fileStream = createWriteStream(fileFullPath)

			response.data.on("data", async (chunk: Buffer) => {
				downloadedLength += chunk.length
				const elapsed = (Date.now() - startTime) / 1000 // seconds
				const speed = downloadedLength / elapsed / 1024 / 1024 // MB/s

				// Check if speed drops below 1MB/s for 10 seconds
				if (Date.now() - lastCheckSpeedTime >= 10000) {
					const recentSpeed = (downloadedLength - lastDownloadedLength) / 10 / 1024 / 1024 // MB/s
					lastDownloadedLength = downloadedLength
					lastCheckSpeedTime = Date.now()

					if (recentSpeed < 1) {
						slowDownloadCount++
						if (slowDownloadCount >= 2) {
							process.stdout.write(`\n⚠️ Slow speed detected (<1MB/s). Restarting download...\n`)
							fileStream.close()
							await fs.unlink(fileFullPath).catch(() => {})
							return false // Restart download
						}
					} else {
						slowDownloadCount = 0 // Reset if speed recovers
					}
				}

				// Update progress every 500ms
				if (Date.now() - lastUpdate > 500) {
					lastUpdate = Date.now()

					let progressText = ""
					let etaText = ""

					if (totalLength) {
						const percent = ((downloadedLength / totalLength) * 100).toFixed(2)
						const barWidth = 30
						const completed = Math.round((downloadedLength / totalLength) * barWidth)
						const progressBar = "[" + "=".repeat(completed) + " ".repeat(barWidth - completed) + "]"
						progressText = `${progressBar} ${percent}%`

						// Estimate remaining time
						if (speed > 0) {
							const remainingTime = ((totalLength - downloadedLength) / (speed * 1024 * 1024)).toFixed(0)
							etaText = `ETA: ${remainingTime}s`
						}
					} else {
						progressText = `${downloadedLength} bytes`
					}

					process.stdout.write(
						`\rDownloading ${fileName} ${progressText} | ${speed.toFixed(2)} MB/s ${etaText}`
					)
				}
			})

			await pipeline(response.data, fileStream)

			const elapsedTime = (Date.now() - startTime) / 1000
			const finalSpeed = downloadedLength / elapsedTime / 1024 / 1024 // MB/s

			process.stdout.write(
				`\r✅ Download complete: ${fileName} | ${elapsedTime.toFixed(2)}s | Speed: ${finalSpeed.toFixed(
					2
				)} MB/s\n`
			)
			return 0
		} catch (error) {
			const c = error as AxiosError

			if (c.response?.status === 404) {
				log.errorNoStack(`File ${link} not found`)
				return -1
			}

			log.errorNoStack(`Error downloading file: ${link}, attempt ${attempt + 1}`, c.message)
			attempt++

			const delay = Math.pow(2, attempt) * 1000 // Exponential backoff
			log.warn(`Retrying in ${delay / 1000}s...`)
			await sleep(delay / 1000)
		}
	}

	log.errorNoStack(`Failed to download file after ${maxRetries} attempts: ${link}`)
	return -2
}

export function getMD5Hash(inputString: string): string {
	const hash = crypto.createHash("md5")
	hash.update(inputString)
	return hash.digest("hex")
}

export function extractMD5(url: string) {
	const md5Regex = /\/([a-f0-9]{32})\./
	const match = url.match(md5Regex)
	return match ? match[1] : null
}

export async function getMD5HashFile(filePath: string, expectedMd5: string): Promise<boolean> {
	try {
		// Read file data
		const fileData = await fs.readFile(filePath)
		// Calculate the MD5 hash
		const hash = crypto.createHash("md5").update(fileData).digest("hex")
		// Compare hashes
		return hash === expectedMd5
	} catch (error) {
		log.debug(`Error reading or hashing file: ${filePath}`, error)
		return false
	}
}

export interface Md5Data {
	remoteName?: string
	md5?: string
	fileSize?: number
	isPatch?: boolean
	localName?: string
}

export async function loadCache(CACHE_FILE: string): Promise<Record<string, any>> {
	try {
		log.warn(`Loading cache file: ${CACHE_FILE}`)
		const data = await fs.readFile(CACHE_FILE, "utf-8")
		return JSON.parse(data)
	} catch {
		return {}
	}
}

export async function saveCache(CACHE_FILE: string, cache: Record<string, any>) {
	const dir = path.dirname(CACHE_FILE)
	await fs.mkdir(dir, { recursive: true }).catch(() => {})

	await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2), "utf-8").catch((err) => {
		log.errorNoStack(`Failed to save cache file ${CACHE_FILE}:`, err.message)
	})
}

export function getMd5Data(x: string): Md5Data {
	let y: Md5Data = {}

	if (x.startsWith("{")) {
		y = JSON.parse(x)
	} else {
		const parts = x.split(" ")
		const [remoteName, fileInfo] = parts
		const [md5, fileSize] = fileInfo.split("|")

		y = {
			remoteName: remoteName,
			md5: md5,
			fileSize: parseInt(fileSize, 10)
		}

		if (parts.length > 2) {
			y.isPatch = true
			if (parts.length > 3) {
				y.localName = parts[3]
			}
		}
	}
	return y
}
