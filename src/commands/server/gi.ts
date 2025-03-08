import Logger from "@UT/logger"
import { Command } from "./Interface"
import fs from "fs/promises"
import { forceDownload, getMd5Data, getMD5HashFile, loadCache, saveCache } from "@UT/library"

const log = new Logger("/gi", "blue")

export default async function handle(command: Command) {
	const folderDownload = `/home/node/app/src/server/web/public/cache/game/genshin`
	const mainUrl = "https://autopatchhk.yuanshen.com"

	// object with the versions sorted in ascending order (make sure the order is correct to avoid 404 download error)
        const list = {
	        '1.0_rel': [
	            {
	                res: {Version: 1135452, Suffix: "1dda342ed1"},
	                clientSilence: {Version: 1141718, Suffix: "f1b1d4173a"},
	                client: {Version: 1146939, Suffix: "35b7968eda"},
	            },
	
	            {
	                res: {Version: 1139692, Suffix: "d2f2ff22c7"},
	            },
	        ],
	
	        '1.0_live': [
	            {
	                res: {Version: 1284249, Suffix: "ba7ad33643"},
	                clientSilence: {Version: 1358691, Suffix: "cdc3f383ef"},
	                client: {Version: 1358691, Suffix: "cdc3f383ef"},
	            },
	
	            {
	                clientSilence: {Version: 1393824, Suffix: "2599c61c7b"},
	            },
	        ]
        }

	const paths = {
		res: {
			Mode: "client_game_res",
			// 'client/Android', 'client/StandaloneWindows64', 'client/iOS', 'client/PS5', 'client/PS4'
			// Clients: ["client/Android", "client/StandaloneWindows64", "client/iOS"],
			Clients: ["client/Android"],
			Mappers: [
				// res files
				"res_versions_external",
				"res_versions_medium",
				"res_versions_streaming",
				"release_res_versions_external",
				"release_res_versions_medium",
				"release_res_versions_streaming",
				// audio files
				"AudioAssets/audio_versions",
				// basic files
				"base_revision",
				"script_version",
				"patch_node_versions", // NEW, I don't know since when but the file might be useful to check which files need to be downloaded in this hotfix version
				"vulkan_gpu_list_config.txt" // android only?
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
                        /*
						if (cache[mapperUrl]) {
							log.info(`Skipping: ${mapperUrl} (Cached 1)`)
							continue
						}
                        */

						// download mapper file
						var isSave0 = await forceDownload(mapperUrl, saveFilePath)
						if (isSave0 != 0) {
							log.errorNoStack(`Download failed ${mapperUrl} > ${saveFilePath}`)
							continue
						}

						// Not a download list file
						if (
							[
								"script_version",
								"base_revision",
								"patch_node_versions",
								"vulkan_gpu_list_config.txt"
							].includes(mapper)
						)
							continue

						// read mapper file
						let fileContent = ""
						try {
							fileContent = await fs.readFile(saveFilePath, "utf-8")
						} catch (error) {
							log.errorNoStack(`File not found: ${saveFilePath}`)
							continue
						}
						// read mapper file line by line
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

							// Check if URL is cached aka done downloading
							if (cache[gameFileUrl]) {
								log.info(`Skipping: ${gameFileUrl} > ${cache[gameFileUrl]} (Cached 2)`)
								continue
							}

							const expectedMd5 = mapperData.md5 || ""

							// Not all files are in the current version, sometimes they are only in the previous version, so to prevent downloading files not found or duplicate download, we make sure that the file already exists in the previous version by checking md5 file only without use output
							const normalizePath = (url: string) => {
								return url
									.replace(mainUrl + "/", "") // Remove base URL
									.replace(/output_\d+_[a-f0-9]+\//, "") // Remove `output_<version>_<suffix>/`
							}
							const filePath = normalizePath(gameFileUrl)
							// Find cache entry, ignoring the version folder
							const cachedEntry = Object.entries(cache).find(([cachedUrl, cachedMd5]) => {
								return normalizePath(cachedUrl) === filePath
							})
							if (cachedEntry) {
								const [cachedUrl, cachedMd5] = cachedEntry

								if (cachedMd5 === expectedMd5) {
									log.info(`Skipping: ${gameFileUrl} > ${cachedUrl} (Cached and MD5 matched)`)
									continue
								} else {
									if (cachedMd5 === "not_found") {
										log.warn(`Skipping: ${gameFileUrl} > ${cachedUrl} (Cached and not found)`)
										continue
									}
									log.errorNoStack(
										`MD5 mismatch for cached file: ${cachedUrl} -> Expected: ${expectedMd5}, Found: ${cachedMd5}`
									)
								}
							}

							// Check MD5 file
							const isValid = await getMD5HashFile(gameFileSavePath, expectedMd5)
							if (!isValid) {
								log.warn(`MD5 mismatch > ${gameFileSavePath} > try download ${gameFileUrl}`)
								var isSave = await forceDownload(gameFileUrl, gameFileSavePath)
								if (isSave == 0) {
									const isValid2 = await getMD5HashFile(gameFileSavePath, expectedMd5)
									if (isValid2) {
										log.info(`Download done and vaild > ${gameFileSavePath}`)
										cache[gameFileUrl] = expectedMd5
										await saveCache(CACHE_FILE, cache)
									} else {
										log.errorNoStack(`Download done but not vaild > ${gameFileSavePath}`)
									}
								} else {
									log.errorNoStack(`Download failed > ${gameFileSavePath}`)
									if (isSave == -1) {
										cache[gameFileUrl] = "not_found"
										await saveCache(CACHE_FILE, cache)
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
