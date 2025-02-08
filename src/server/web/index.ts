import cookieParser from "cookie-parser"
import express, { NextFunction, Request, Response } from "express"
import cors from "cors"
import Logger from "@UT/logger"
import { createServer, IncomingMessage, Server, ServerResponse } from "node:http"
import { GetProfile } from "@UT/config"

// API
import { isMainThread } from "worker_threads"

// Router
import WebRouter from "@SV/web/router"

const log = new Logger("Web")
const w = express()

// Proxy
w.set("trust proxy", 2)
// Core
w.use(cors())
// Web static
w.use(express.static("./src/server/web/public"))

// Body
w.use(express.urlencoded({ extended: true, limit: "10kb" }))
w.use(express.text({ limit: "10kb" }))
w.use(function (err: any, req: Request, res: Response, next: NextFunction) {
	if (err) {
		log.errorNoStack(`ErrorText: ${req.path} > ${err.message}`)
		return res.send("limit send!")
	} else {
		next(err)
	}
})
w.use(express.json({ limit: "200kb" }))
w.use(function (err: any, req: Request, res: Response, next: NextFunction) {
	if (err) {
		log.errorNoStack(`ErrorJson: ${req.path} > ${err.message}`)
		return res.json({
			code: 0,
			status: `limit send!`
		})
	} else {
		next(err)
	}
})

// Cookie
w.use(cookieParser())

// Router
w.use(WebRouter)

// 404
w.use((req: Request, res: Response) => {
	var url = req.url

	log.warn({
		url,
		name: "404 Error",
		query: req.query,
		body: req.body,
		params: req.params,
		header: req.headers,
		cookie: req.cookies
	})
	
	return res.status(404).json({
		code: 0,
		message: "Not found"
	})
})

// Error 500+
w.use((err: Error, req: Request, res: Response) => {
	log.errorNoStack(`Error: ${req.path} > ${err.message}`, err)
	return res.status(500).json({
		code: 500,
		message: "Internal Server Error"
	})
})

class WebServer {
	private port: number = 8081
	private server: Server<typeof IncomingMessage, typeof ServerResponse> | undefined

	constructor(port: number) {
		this.port = port
		if (isMainThread) {
			log.info(`This is main thread for web server`)
			this.Start()
		} else {
			log.info(`This is another thread for web server`)
		}
	}

	public Start() {
		var me = this
		this.server = createServer(w)
		this.server.listen(me.port, function () {
			log.info(`Server started on port ${me.port}`)
		})
	}

	public Run() {
		log.info(`Pong`)
	}
}

const instance = new WebServer(GetProfile().port.private)
export default instance