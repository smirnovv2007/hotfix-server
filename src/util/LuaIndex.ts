import { EndianBinaryReader } from "./EndianBinaryReader"

export class LuaIndex {
	public Unk1: bigint
	public FileCount: number
	public Unk2: number
	public Files: LuaIndex.FileEntry[]

	constructor() {
		this.Unk1 = 0n
		this.FileCount = 0
		this.Unk2 = 0
		this.Files = []
	}

	/**
	 * Reads a LuaIndex from a Buffer.
	 * @param indexBytes The Buffer containing the index file data.
	 */
	public static read(indexBytes: Buffer): LuaIndex {
		// Create a reader (assuming no swapping and no debug output)
		const br = new EndianBinaryReader(indexBytes, false, false)
		return LuaIndex.readFromReader(br)
	}

	/**
	 * Reads a LuaIndex from an EndianBinaryReader.
	 * Note: Unk1 is read as a 64-bit little-endian integer.
	 * FileCount is read as a 32-bit big-endian integer.
	 * Unk2 is read as a 32-bit little-endian integer.
	 */
	public static readFromReader(br: EndianBinaryReader): LuaIndex {
		const index = new LuaIndex()

		// Read Unk1 (64-bit little-endian)
		index.Unk1 = br.buffer.readBigInt64LE(br.offset)
		br.offset += 8

		// Read FileCount (32-bit big-endian)
		index.FileCount = br.readInt32BE()

		// Read Unk2 (32-bit little-endian)
		index.Unk2 = br.readInt32LE()

		// Read each file entry.
		for (let i = 0; i < index.FileCount; i++) {
			index.Files.push(LuaIndex.FileEntry.read(br))
		}

		return index
	}

	/**
	 * Recalculates each file entry's DataEntry offsets.
	 */
	public recalcSizeOffsets(): void {
		for (const file of this.Files) {
			let offset = 0
			for (const entry of file.Entries) {
				entry.Offset = offset
				offset += entry.Size
			}
		}
	}
}

export namespace LuaIndex {
	export class FileEntry {
		public NameHash: number
		public FileHash: string
		public ReadSize: bigint
		public Entries: FileEntry.DataEntry[]
		public Unk: number

		constructor() {
			this.NameHash = 0
			this.FileHash = ""
			this.ReadSize = 0n
			this.Entries = []
			this.Unk = 0
		}

		/**
		 * Calculates the sum of the sizes of all data entries.
		 */
		public get Size(): number {
			return this.Entries.reduce((total, entry) => total + entry.Size, 0)
		}

		public static read(br: EndianBinaryReader): FileEntry {
			const entry = new FileEntry()

			// Read NameHash as a 32-bit BE integer.
			entry.NameHash = br.readInt32BE()

			// Read FileHash as a straight 16-byte hash.
			entry.FileHash = br.readStraightHash()

			// Read ReadSize as a 64-bit unsigned integer (big-endian).
			entry.ReadSize = br.readUInt64BE()

			// Read the count of DataEntry records (32-bit BE).
			const cnt = br.readUInt32BE()

			// Read each DataEntry.
			for (let i = 0; i < cnt; i++) {
				entry.Entries.push(FileEntry.DataEntry.read(br))
			}

			// Verify sequential offsets.
			let offset = 0
			for (const de of entry.Entries) {
				if (offset !== de.Offset) {
					throw new Error("Offset mismatch")
				}
				offset += de.Size
			}

			// Read the extra byte.
			entry.Unk = br.readByte()

			// Validate that the read size matches the calculated size.
			if (entry.ReadSize !== BigInt(entry.Size)) {
				throw new Error(
					`Size mismatch in filehash ${entry.FileHash}: read ${entry.ReadSize}, calc ${entry.Size} (diff ${
						entry.ReadSize - BigInt(entry.Size)
					})`
				)
			}

			return entry
		}
	}

	export namespace FileEntry {
		export class DataEntry {
			public NameHash: number
			public Size: number
			public Offset: number

			constructor() {
				this.NameHash = 0
				this.Size = 0
				this.Offset = 0
			}

			public static read(br: EndianBinaryReader): DataEntry {
				const entry = new DataEntry()
				entry.NameHash = br.readInt32BE()
				entry.Size = br.readUInt32BE()
				entry.Offset = br.readUInt32BE()
				return entry
			}
		}
	}
}
