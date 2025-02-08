import Logger from "@UT/logger"
import { Command } from "./Interface"
import fs from "fs/promises"
import { forceDownload, getMd5Data, getMD5HashFile, loadCache, saveCache } from "@UT/library"

const log = new Logger("/gi", "blue")

export default async function handle(command: Command) {
	const folderDownload = `/home/node/app/src/server/web/public/cache/game/genshin`
	const mainUrl = "https://autopatchhk.yuanshen.com"

	const list = {
		"5.0_live": [
			{ client: { Version: 26487341, Suffix: "57a90bbd52" } },
			{ clientSilence: { Version: 26530839, Suffix: "185bf02ea7" } },
			{ res: { Version: 26161852, Suffix: "4c9dae0f9a" }, client: { Version: 26547926, Suffix: "3d43078d67" } },
			{
				res: { Version: 26458901, Suffix: "befdda25ff" },
				clientSilence: { Version: 26594938, Suffix: "e3714681f7" },
				client: { Version: 26594938, Suffix: "e3714681f7" }
			},
			{
				res: { Version: 26709834, Suffix: "034791c61b" },
				clientSilence: { Version: 26720294, Suffix: "79e8f3e212" },
				client: { Version: 26720294, Suffix: "79e8f3e212" }
			}
		]
	}

	const paths = {
		res: {
			Mode: "client_game_res",
			// 'client/Android', 'client/StandaloneWindows64', 'client/iOS', 'client/PS5', 'client/PS4'
			Clients: ["client/Android", "client/StandaloneWindows64", "client/iOS"],
			Mappers: [
				"res_versions_external",
				"res_versions_medium",
				"res_versions_streaming",
				"release_res_versions_external",
				"release_res_versions_medium",
				"release_res_versions_streaming",
				"base_revision",
				"script_version",
				"AudioAssets/audio_versions"
			]
		},
		clientSilence: {
			Mode: "client_design_data",
			Clients: ["client_silence/General/AssetBundles"],
			Mappers: ["data_versions"]
		},
		client: { Mode: "client_design_data", Clients: ["client/General/AssetBundles"], Mappers: ["data_versions"] }
	}

	const resolvers = { AudioAssets: ["pck"], VideoAssets: ["cuepoint", "usm"], AssetBundles: ["blk"] }

	for (const [version, versionDatas] of Object.entries(list)) {
		// Cache Folder
		const CACHE_FILE = `${folderDownload}/md5/${version}.json`
		const cache = await loadCache(CACHE_FILE)

		for (const versionData of versionDatas) {
			for (const [liveType, liveData] of Object.entries(versionData)) {
				const pathData = paths[liveType as keyof typeof paths]
				for (const client of pathData.Clients) {
					for (const mapper of pathData.Mappers) {
						const fileFolder = `${pathData.Mode}/${version}/output_${liveData.Version}_${liveData.Suffix}/${client}`
						const mapperUrl = `${mainUrl}/${fileFolder}/${mapper}`
						const saveFileFolder = `${folderDownload}/${fileFolder}`
						const saveFilePath = `${saveFileFolder}/${mapper}`

						// Check if URL is cached
						if (cache[mapperUrl]) {
							log.warn(`Skipping: ${mapperUrl} (Cached)`)
							continue
						}

						await forceDownload(mapperUrl, saveFilePath)

						if (["script_version", "base_revision"].includes(mapper)) continue

						let fileContent = ""
						try {
							fileContent = await fs.readFile(saveFilePath, "utf-8")
						} catch (error) {
							log.warn(`File not found: ${saveFilePath}`)
							continue
						}

						const mapperLines = fileContent.split("\n")

						for (const line of mapperLines) {
							if (!line) continue
							const mapperData = getMd5Data(line)
							if (!mapperData?.remoteName) continue
							if (mapperData.remoteName === "svc_catalog") continue

							const ext = mapperData.remoteName.split(".").pop() as string

							let extFolder = ""
							for (const [resolveFolder, resolveExts] of Object.entries(resolvers)) {
								if (resolveExts.includes(ext)) {
									extFolder = resolveFolder
									break
								}
							}
							if (extFolder && saveFileFolder.includes(extFolder)) {
								extFolder = ""
							}

							const gameFileSavePath = `${saveFileFolder}/${extFolder}/${mapperData.remoteName}`
							const gameFileUrl =
								`${mainUrl}/${fileFolder}/${extFolder}/${mapperData.remoteName}`.replace(
									`${fileFolder}//`,
									`${fileFolder}/`
								)

							if (cache[gameFileUrl]) {
								log.warn(`Skipping: ${gameFileUrl} (Cached)`)
								continue
							}

							// Check MD5
							const expectedMd5 = mapperData.md5 || ""
							const isValid = await getMD5HashFile(gameFileSavePath, expectedMd5)
							if (!isValid) {
								log.warn(`MD5 mismatch > ${gameFileSavePath} > try download ${gameFileUrl}`)
								var isSave = await forceDownload(gameFileUrl, gameFileSavePath)
								if (isSave) {
									const isValid2 = await getMD5HashFile(gameFileSavePath, expectedMd5)
									if (isValid2) {
										log.info(`Download done and vaild > ${gameFileSavePath}`)
										cache[gameFileUrl] = expectedMd5
										await saveCache(CACHE_FILE, cache)
									} else {
										log.warn(`Download done but not vaild > ${gameFileSavePath}`)
									}
								}
							} else {
								log.info(`MD5 check passed > ${gameFileSavePath}`)
								cache[gameFileUrl] = expectedMd5
								await saveCache(CACHE_FILE, cache)
							}
						}
					}
				}
			}
		}
	}

	log.warn("Done ^_^")
}
