import Config from "@UT/config"

export enum VerboseLevel {
	NONE,
	INFO,
	ERROR,
	WARNS,
	DEBUG,
	VERBL,
	VERBH
}

type Color = "red" | "green" | "yellow" | "blue" | "magenta" | "cyan" | "white" | "gray" | "black"

const DEFAULT_LEVEL_COLORS: Record<VerboseLevel, Color> = {
	[VerboseLevel.NONE]: "white",
	[VerboseLevel.INFO]: "blue",
	[VerboseLevel.ERROR]: "red",
	[VerboseLevel.WARNS]: "yellow",
	[VerboseLevel.DEBUG]: "gray",
	[VerboseLevel.VERBL]: "green",
	[VerboseLevel.VERBH]: "magenta"
}

export default class Logger {
	private name: string
	private levelColors: Record<VerboseLevel, Color>
	private nameColor: Color

	constructor(name: string, nameColor: Color = "white", levelColor?: Color) {
		this.name = name
		this.nameColor = nameColor
		this.levelColors = { ...DEFAULT_LEVEL_COLORS }

		if (levelColor) {
			this.levelColors = {
				...this.levelColors,
				[VerboseLevel.WARNS]: levelColor
			}
		}
	}

	private getDate(): string {
		return new Date().toLocaleTimeString()
	}

	private getColorizedText(text: string, color: Color): string {
		const colorMap: Record<Color, string> = {
			red: "\x1b[31m",
			green: "\x1b[32m",
			yellow: "\x1b[33m",
			blue: "\x1b[34m",
			magenta: "\x1b[35m",
			cyan: "\x1b[36m",
			white: "\x1b[37m",
			gray: "\x1b[90m",
			black: "\x1b[90m"
		}
		const resetColor = "\x1b[0m"
		return `${colorMap[color]}${text}${resetColor}`
	}

	private logMessage(type: VerboseLevel, args: any[]) {
		if (Config.logger >= type) {
			const timestamp = this.getDate()
			const levelColorized = this.getColorizedText(VerboseLevel[type], this.levelColors[type])
			const nameColorized = this.getColorizedText(this.name, this.nameColor)
			const logPrefix = `[${timestamp}] ${levelColorized}<${nameColorized}>`
			console.log(logPrefix, ...args);
		}
	}

	public trail(...args: any[]) {
		console.log(`\t↳ ${args.join(" ")}`)
	}

	public log(...args: any[]) {
		this.logMessage(VerboseLevel.NONE, args)
	}

	public info(...args: any[]) {
		this.logMessage(VerboseLevel.INFO, args)
	}

	public error(...args: any[]) {
		this.logMessage(VerboseLevel.ERROR, args)
		const errorMessage = args.join(" ") // Concatenate the args into a single string
		const stack = new Error(errorMessage).stack!.split("\n").slice(2).join("\n")
		this.trail(stack)
	}

	public errorNoStack(...args: any[]) {		
		this.logMessage(VerboseLevel.ERROR, args)
	}

	public warn(...args: any[]) {
		this.logMessage(VerboseLevel.WARNS, args)
	}

	public debug(...args: any[]) {
		this.logMessage(VerboseLevel.DEBUG, args)
	}

	public verbL(...args: any[]) {
		this.logMessage(VerboseLevel.VERBL, args)
		//this.trail(new Error().stack!.split("\n").slice(2).join("\n"))
	}

	public verbH(...args: any[]) {
		this.logMessage(VerboseLevel.VERBH, args)
		//this.trail(new Error().stack!.split("\n").slice(2).join("\n"))
	}
}
