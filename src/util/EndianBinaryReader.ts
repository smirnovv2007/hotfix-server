export class EndianBinaryReader {
	public buffer: Buffer
	public offset: number
	private debug: boolean
	private useSwap: boolean // if true, data is stored in little-endian and needs swapping

	constructor(buffer: Buffer, useSwap = false, debug = false) {
		this.buffer = buffer
		this.offset = 0
		this.debug = debug
		this.useSwap = useSwap
	}

	// Reads a single byte.
	readByte(): number {
		const value = this.buffer.readUInt8(this.offset)
		this.offset++
		return value
	}

	// Reads a block of bytes.
	readBytes(length: number): Buffer {
		const value = this.buffer.subarray(this.offset, this.offset + length)
		this.offset += length
		return value
	}

	// Helper to swap a 32-bit unsigned integer.
	private swapBytes32(x: number): number {
		// Swap adjacent 16-bit blocks, then adjacent 8-bit blocks.
		x = ((x >>> 16) | (x << 16)) >>> 0
		return (((x & 0xff00ff00) >>> 8) | ((x & 0x00ff00ff) << 8)) >>> 0
	}

	// Helper to swap a 64-bit unsigned integer (using BigInt).
	private swapBytes64(x: bigint): bigint {
		x = ((x >> 32n) | (x << 32n)) & 0xffffffffffffffffn
		x = (((x & 0xffff0000ffff0000n) >> 16n) | ((x & 0x0000ffff0000ffffn) << 16n)) & 0xffffffffffffffffn
		return (((x & 0xff00ff00ff00ff00n) >> 8n) | ((x & 0x00ff00ff00ff00ffn) << 8n)) & 0xffffffffffffffffn
	}

	// Reads a 32-bit little-endian signed integer.
	readInt32LE(): number {
		const value = this.buffer.readInt32LE(this.offset)
		this.offset += 4
		return value
	}

	// Reads a 32-bit unsigned integer as big-endian.
	readUInt32BE(): number {
		if (this.useSwap) {
			// If data is stored little-endian, read LE and then swap.
			const raw = this.buffer.readUInt32LE(this.offset)
			this.offset += 4
			return this.swapBytes32(raw)
		} else {
			const value = this.buffer.readUInt32BE(this.offset)
			this.offset += 4
			return value
		}
	}

	// Reads a 64-bit unsigned integer as big-endian.
	readUInt64BE(): bigint {
		if (this.useSwap) {
			const raw = this.buffer.readBigUInt64LE(this.offset)
			this.offset += 8
			return this.swapBytes64(raw)
		} else {
			const value = this.buffer.readBigUInt64BE(this.offset)
			this.offset += 8
			return value
		}
	}

	// Reads a 32-bit signed integer as big-endian.
	readInt32BE(): number {
		const uint = this.readUInt32BE()
		return uint | 0
	}

	// Reads a 64-bit signed integer as big-endian.
	readInt64BE(): bigint {
		let u: bigint
		if (this.useSwap) {
			u = this.readUInt64BE()
		} else {
			u = this.buffer.readBigInt64BE(this.offset)
			this.offset += 8
		}
		return BigInt.asIntN(64, u)
	}

	// Reads an Excel-style bitfield.
	readExcelBitfield(): boolean[] {
		const res: boolean[] = []
		let curByte: number
		do {
			curByte = this.readByte()
			let proc = curByte & 0x7f
			for (let i = 0; i < 7; i++) {
				res.push((proc & 0x1) !== 0)
				proc >>= 1
			}
		} while ((curByte & 0x80) !== 0)
		return res
	}

	// Reads a variable-length unsigned integer.
	readVarInt(): bigint {
		let res = 0n
		let shift = 0
		let read = BigInt(this.readByte())
		while ((read & 0x80n) === 0x80n) {
			const tmp = read & 0x7fn
			res |= tmp << BigInt(shift)
			read = BigInt(this.readByte())
			shift += 7
		}
		res |= (read & 0x7fn) << BigInt(shift)
		return res
	}

	// Reads a variable-length signed integer.
	readSignedVarInt(): bigint {
		const pre = this.readVarInt()
		return this.decodeZigZag(pre)
	}

	// Decodes a ZigZag-encoded integer.
	private decodeZigZag(value: bigint): bigint {
		return (value & 0x1n) === 0x1n ? -1n * ((value >> 1n) + 1n) : value >> 1n
	}

	// Reads a hash by reading 4 chunks of 4 bytes, reversing each chunk.
	readHash(): string {
		const fullHash = Buffer.alloc(16)
		let k = 0
		for (let i = 0; i < 4; i++) {
			const chunk = this.readBytes(4)
			for (let j = 3; j >= 0; j--, k++) {
				fullHash[k] = chunk[j]
			}
		}
		return fullHash.toString("hex").toLowerCase()
	}

	// Reads a 16-byte hash without reordering.
	readStraightHash(): string {
		const fullHash = this.readBytes(16)
		return fullHash.toString("hex").toLowerCase()
	}

	// ---------- New Methods for Design File Parsing ----------

	// Reads a sequence of characters (assumes UTF-8 encoding and one byte per character).
	readChars(count: number): string {
		const bytes = this.readBytes(count)
		return bytes.toString("utf8")
	}

	// Reads a 16-bit little-endian signed integer.
	readInt16(): number {
		const value = this.buffer.readInt16LE(this.offset)
		this.offset += 2
		return value
	}

	// Reads a 7-bit encoded integer (used for string lengths in .NET BinaryReader).
	read7BitEncodedInt(): number {
		let count = 0
		let shift = 0
		let byteVal: number
		do {
			byteVal = this.readByte()
			count |= (byteVal & 0x7f) << shift
			shift += 7
		} while (byteVal & 0x80)
		return count
	}

	// Reads a string: first reads a 7-bit encoded integer length, then that many bytes (UTF-8).
	readString(): string {
		const length = this.read7BitEncodedInt()
		return this.readBytes(length).toString("utf8")
	}
}
