import acfg from "acfg"

export const _ = acfg({
	logger: 3,
	profile: [
		{
			name: "prod",
			title: "Yuuki Hotfix Server - PROD",
			url: {
				public: "https://hotfix.yuuki.me",
				private: "http://2.0.0.101:10030"
			},
			port: {
				public: 443,
				private: 10030
			}
		},
		{
			name: "dev",
			title: "Yuuki Hotfix Server - DEV",
			url: {
				public: "http://2.0.0.101:50030",
				private: "http://2.0.0.101:50030"
			},
			port: {
				public: 50020,
				private: 50020
			}
		}
	]
})

const argv = require("minimist")(process.argv.slice(2))
/**
 * Get Profile Web
 */
export function GetProfile() {
	const set_env = argv.env || "prod"
	let config_tmp = _.profile.find((profile) => profile.name === set_env)
	if (config_tmp == undefined) {
		process.exit(1)
	}
	return config_tmp
}

/**
 * Get URL Domain Public
 * @returns {URL}
 */
export function GetDomain(): URL{
	return new URL(GetProfile().url.public)
}

export default _
